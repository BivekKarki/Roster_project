"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import type { ActionState } from "@/lib/types";
import { firstError, formToObject, siteSchema } from "@/lib/validation";

export async function saveSite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = siteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id, renameExisting, fillBlankRates, ...fields } = parsed.data;

  const existing = id ? await prisma.site.findFirst({ where: { id, userId } }) : null;
  if (id && !existing) return { error: "That employer no longer exists." };

  const renamed = !!existing && (existing.employer !== fields.employer || existing.location !== fields.location);

  try {
    await prisma.$transaction([
      existing
        ? prisma.site.update({ where: { id: existing.id }, data: fields })
        : prisma.site.create({ data: { ...fields, userId } }),
      // Optional: rename the snapshot names on existing shifts (names only).
      ...(existing && renamed && renameExisting
        ? [prisma.shift.updateMany({
            where: { userId, employer: existing.employer, location: existing.location },
            data: { employer: fields.employer, location: fields.location },
          })]
        : []),
      // Optional: fill the new default rate into shifts that have NO rate. Never overwrites a rate.
      ...(fillBlankRates && fields.defaultRate !== null
        ? [prisma.shift.updateMany({
            where: { userId, employer: fields.employer, location: fields.location, rate: null },
            data: { rate: fields.defaultRate },
          })]
        : []),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { error: "This employer and location already exist." };
    throw error;
  }

  revalidatePath("/", "layout");
  redirect("/settings");
}

export async function deleteSite(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  // Shifts keep their own employer/location copy; their siteId is set to NULL by the database.
  await prisma.site.deleteMany({ where: { id, userId } });
  revalidatePath("/", "layout");
  redirect("/settings");
}
