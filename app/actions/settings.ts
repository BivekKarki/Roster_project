"use server";

import { revalidatePath } from "next/cache";
import { bumpUser } from "@/lib/cache";
import { payDatesFor } from "@/lib/calc";
import { isoToDb } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import { requireUserIdForWrite } from "@/lib/session";
import type { ActionState } from "@/lib/types";
import { firstError, formToObject, payCycleSchema, settingsSchema } from "@/lib/validation";

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserIdForWrite();
  const parsed = settingsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { fortnightStart, ...rest } = parsed.data;
  const data = { ...rest, fortnightStart: isoToDb(fortnightStart) };
  await prisma.settings.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  bumpUser(userId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved" };
}

/**
 * Sets one pay cycle on every employer, and optionally recalculates the supposed and real
 * pay dates of all UNPAID shifts. Paid shifts are never changed.
 */
export async function applyPayCycleToAll(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserIdForWrite();
  const parsed = payCycleSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { payPeriodStart, payPeriodDays, payWeekday, payLateDays, recalcUnpaid } = parsed.data;
  const cycle = { payPeriodStart, payPeriodDays, payWeekday, payLateDays, payDelayDays: 14 };

  const result = await prisma.$transaction(async (tx) => {
    const sites = await tx.site.updateMany({
      where: { userId },
      data: {
        payPeriodStart: isoToDb(payPeriodStart), payPeriodDays, payWeekday, payLateDays,
        payFrequency: payPeriodDays === 7 ? "WEEKLY" : "FORTNIGHTLY",
      },
    });

    // Kept in sync as the fallback for when no employer has a pay cycle.
    await tx.settings.updateMany({ where: { userId }, data: { fortnightStart: isoToDb(payPeriodStart) } });

    let recalculated = 0;
    if (recalcUnpaid) {
      const unpaid = await tx.shift.findMany({
        where: { userId, paid: false, status: { not: "CANCELLED" } },
        select: { id: true, date: true },
      });
      for (const s of unpaid) {
        const pay = payDatesFor(s.date.toISOString().slice(0, 10), cycle, 14);
        await tx.shift.update({
          where: { id: s.id },
          data: {
            payPeriodStart: isoToDb(pay.periodStart!),
            payPeriodEnd: isoToDb(pay.periodEnd!),
            officialPayDate: isoToDb(pay.officialPayDate!),
            expectedPayDate: isoToDb(pay.expectedPayDate),
          },
        });
      }
      recalculated = unpaid.length;
    }
    return { sites: sites.count, recalculated };
  }, { timeout: 60_000 });

  bumpUser(userId);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Pay cycle saved on ${plural(result.sites, "employer")}${recalcUnpaid ? ` and ${plural(result.recalculated, "unpaid shift")} updated` : ""}. Paid shifts were not changed.`,
  };
}
