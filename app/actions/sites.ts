"use server";

import { revalidatePath } from "next/cache";
import { bumpUser } from "@/lib/cache";
import { redirect } from "next/navigation";
import { payDatesFor } from "@/lib/calc";
import { isoToDb } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { toSiteDTO } from "@/lib/mappers";
import { requireUserIdForWrite } from "@/lib/session";
import type { ActionState } from "@/lib/types";
import { firstError, formToObject, siteSchema } from "@/lib/validation";

export async function saveSite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserIdForWrite();
  const parsed = siteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id, renameExisting, fillBlankRates, recalcUnpaid, payPeriodStart, ...rest } = parsed.data;
  if ((payPeriodStart === null) !== (rest.payWeekday === null)) {
    return { error: "To use a pay cycle, set both the pay period start date and the pay day." };
  }
  const fields = { ...rest, payPeriodStart: payPeriodStart ? isoToDb(payPeriodStart) : null };

  const existing = id ? await prisma.site.findFirst({ where: { id, userId } }) : null;
  if (id && !existing) return { error: "That employer no longer exists." };
  const renamed = !!existing && (existing.employer !== fields.employer || existing.location !== fields.location);

  try {
    await prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.site.update({ where: { id: existing.id }, data: fields })
        : await tx.site.create({ data: { ...fields, userId } });

      // Optional: rename the snapshot names on existing shifts (names only).
      if (existing && renamed && renameExisting) {
        await tx.shift.updateMany({
          where: { userId, employer: existing.employer, location: existing.location },
          data: { employer: fields.employer, location: fields.location },
        });
      }

      // Optional: fill the default rate into shifts with NO rate. Never overwrites a rate.
      if (fillBlankRates && fields.defaultRate !== null) {
        await tx.shift.updateMany({
          where: { userId, employer: fields.employer, location: fields.location, rate: null },
          data: { rate: fields.defaultRate },
        });
      }

      // Optional: recalculate pay dates for UNPAID shifts only. Paid shifts are never touched.
      if (recalcUnpaid) {
        const settings = await tx.settings.findUnique({ where: { userId }, select: { payDelayDays: true } });
        const cycle = toSiteDTO(saved);
        const unpaid = await tx.shift.findMany({
          where: { userId, employer: fields.employer, location: fields.location, paid: false, status: { not: "CANCELLED" } },
          select: { id: true, date: true },
        });
        for (const s of unpaid) {
          const pay = payDatesFor(s.date.toISOString().slice(0, 10), cycle, settings?.payDelayDays ?? 14);
          await tx.shift.update({
            where: { id: s.id },
            data: {
              payPeriodStart: pay.periodStart ? isoToDb(pay.periodStart) : null,
              payPeriodEnd: pay.periodEnd ? isoToDb(pay.periodEnd) : null,
              officialPayDate: pay.officialPayDate ? isoToDb(pay.officialPayDate) : null,
              expectedPayDate: isoToDb(pay.expectedPayDate),
            },
          });
        }
      }
    }, { timeout: 30_000 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { error: "This employer and location already exist." };
    throw error;
  }

  bumpUser(userId);
  revalidatePath("/", "layout");
  redirect("/settings");
}

export async function deleteSite(formData: FormData) {
  const userId = await requireUserIdForWrite();
  const id = String(formData.get("id") ?? "");
  // Shifts keep their own employer/location copy; their siteId is set to NULL by the database.
  await prisma.site.deleteMany({ where: { id, userId } });
  bumpUser(userId);
  revalidatePath("/", "layout");
  redirect("/settings");
}
