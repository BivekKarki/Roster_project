"use server";

import { revalidatePath } from "next/cache";
import { isoToDb } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import type { ActionState } from "@/lib/types";
import { firstError, formToObject, settingsSchema } from "@/lib/validation";

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = settingsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { fortnightStart, ...rest } = parsed.data;
  const data = { ...rest, fortnightStart: isoToDb(fortnightStart) };
  await prisma.settings.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved" };
}
