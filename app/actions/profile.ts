"use server";

import { revalidatePath } from "next/cache";
import { bumpUser } from "@/lib/cache";
import { signOut, unstable_update } from "@/auth";
import { DEFAULT_FORTNIGHT_START } from "@/lib/calc";
import { isoToDb } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { IDLE_OPTIONS } from "@/lib/session-rules";
import { requireUserIdForWrite } from "@/lib/session";
import type { ActionState } from "@/lib/types";
import { autoLogoutSchema, firstError, formToObject, profileSchema } from "@/lib/validation";

const MAX_AVATAR_BYTES = 1024 * 1024; // the browser resizes first; this is a safety limit
const IMAGE_SIGNATURES: { type: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 },
];

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserIdForWrite();
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await prisma.user.update({ where: { id: userId }, data: { name: parsed.data.name || null } });
  await unstable_update({ user: { name: parsed.data.name || null } });
  bumpUser(userId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Name saved" };
}

export async function updateAutoLogout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserIdForWrite();
  const parsed = autoLogoutSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const minutes = parsed.data.idleTimeoutMinutes;
  await prisma.settings.upsert({
    where: { userId },
    update: { idleTimeoutMinutes: minutes },
    create: { userId, idleTimeoutMinutes: minutes, fortnightStart: isoToDb(DEFAULT_FORTNIGHT_START) },
  });
  // Put the new timeout into the session cookie straight away.
  await unstable_update({ idleMinutes: minutes });
  bumpUser(userId);
  revalidatePath("/", "layout");
  const label = IDLE_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes} minutes`;
  return { ok: true, message: minutes === 0 ? "Automatic logout turned off" : `You'll be logged out after ${label} without activity` };
}

export async function uploadAvatar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserIdForWrite();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > MAX_AVATAR_BYTES) return { error: "That photo is too large. Try a smaller one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = IMAGE_SIGNATURES.find((s) => s.test(bytes));
  if (!kind) return { error: "Use a JPG, PNG or WebP photo." };
  await prisma.user.update({
    where: { id: userId },
    data: { avatar: bytes, avatarType: kind.type, avatarUpdatedAt: new Date() },
  });
  bumpUser(userId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo updated" };
}

export async function removeAvatar() {
  const userId = await requireUserIdForWrite();
  await prisma.user.update({ where: { id: userId }, data: { avatar: null, avatarType: null, avatarUpdatedAt: null } });
  bumpUser(userId);
  revalidatePath("/", "layout");
}

/** Called by the browser when the idle countdown reaches zero. */
export async function idleLogout() {
  await signOut({ redirectTo: "/login?reason=idle" });
}
