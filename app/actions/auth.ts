"use server";

import { DEFAULT_FORTNIGHT_START } from "@/lib/calc";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { isoToDb } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { createSampleData } from "@/lib/sample";
import type { ActionState } from "@/lib/types";
import { firstError, formToObject, loginSchema, signupSchema } from "@/lib/validation";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Email or password is incorrect." };
    throw error; // lets Next.js perform the redirect
  }
  return { ok: true };
}

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (process.env.ALLOW_SIGNUP === "false") return { error: "Sign-up is turned off for this app." };
  const parsed = signupSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email, password, sample } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "An account with this email already exists. Log in instead." };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email, name: name || null, passwordHash,
      settings: { create: { fortnightStart: isoToDb(DEFAULT_FORTNIGHT_START) } },
    },
  });
  if (sample) await createSampleData(user.id);

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Account created. Please log in." };
    throw error;
  }
  return { ok: true };
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
