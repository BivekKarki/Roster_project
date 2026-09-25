"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { DEFAULT_FORTNIGHT_START } from "@/lib/calc";
import { isoToDb } from "@/lib/dates";
import { bumpUser } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { EmailNotConfiguredError } from "@/lib/email";
import { createSampleData } from "@/lib/sample";
import type { ActionState } from "@/lib/types";
import { firstError, formToObject, loginSchema, resendSchema, signupSchema, verifyCodeSchema } from "@/lib/validation";
import {
  canSendVerification, createLoginTicket, sendVerificationEmail, verificationRequired, verifyCode,
} from "@/lib/verification";
import { waitText } from "@/lib/verification-rules";

export type VerifyState = (ActionState & { retryAfter?: number }) | undefined;

const verifyUrl = (email: string, extra = "") => `/verify-email?email=${encodeURIComponent(email)}${extra}`;

/** Sends a code if the rate limits allow. Returns a message for the user when it can't. */
async function trySendCode(user: { id: string; email: string; name: string | null }) {
  const decision = await canSendVerification(user.id);
  if (!decision.allowed) return { sent: false, retryAfter: decision.retryAfterSeconds };
  try {
    await sendVerificationEmail(user);
    return { sent: true as const };
  } catch (error) {
    console.error("Verification email failed:", error);
    return {
      sent: false,
      error: error instanceof EmailNotConfiguredError ? error.message : "We couldn't send the email just now. Try again in a minute.",
    };
  }
}

/** Signs in with a one-time ticket right after verification, then goes to the dashboard. */
async function signInVerified(userId: string) {
  const ticket = await createLoginTicket(userId);
  await signIn("ticket", { ticket, redirectTo: "/?verified=1" });
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  if (verificationRequired()) {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, name: true, passwordHash: true, emailVerifiedAt: true },
    });
    // Right password but email not confirmed yet: send a code (if allowed) and go to the verify screen.
    if (user && !user.emailVerifiedAt && (await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      const result = await trySendCode(user);
      redirect(verifyUrl(user.email, result.sent ? "&sent=1" : ""));
    }
  }

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

  const existing = await prisma.user.findUnique({ where: { email }, select: { emailVerifiedAt: true } });
  if (existing) {
    return {
      error: existing.emailVerifiedAt || !verificationRequired()
        ? "An account with this email already exists. Log in instead."
        : "This email is waiting to be confirmed. Log in with your password to get a new code.",
    };
  }

  const mustVerify = verificationRequired();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email, name: name || null, passwordHash,
      emailVerifiedAt: mustVerify ? null : new Date(),
      settings: { create: { fortnightStart: isoToDb(DEFAULT_FORTNIGHT_START) } },
    },
    select: { id: true, email: true, name: true },
  });
  if (sample) { await createSampleData(user.id); bumpUser(user.id); }

  if (mustVerify) {
    const result = await trySendCode(user);
    redirect(verifyUrl(user.email, result.sent ? "&sent=1" : "&unsent=1"));
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Account created. Please log in." };
    throw error;
  }
  return { ok: true };
}

export async function verifyEmail(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const parsed = verifyCodeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const result = await verifyCode(parsed.data.email, parsed.data.code);
  if (result.ok) {
    await signInVerified(result.userId);
    return { ok: true };
  }
  switch (result.error) {
    case "already-verified":
      redirect("/login?verified=1");
    case "expired":
      return { error: "That code has expired. Tap “Send a new code”." };
    case "too-many":
      return { error: "Too many wrong attempts. Tap “Send a new code” to get a fresh one." };
    case "no-code":
      return { error: "There's no active code for this email. Tap “Send a new code”." };
    default:
      return {
        error: result.attemptsLeft
          ? `That code isn't right. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.`
          : "That code isn't right.",
      };
  }
}

export async function resendVerification(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const parsed = resendSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const neutral = { ok: true, message: "If this email needs confirming, a new code is on its way. Check your spam folder too." };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return neutral;

  const result = await trySendCode(user);
  if (result.sent) return { ok: true, message: "New code sent. Older codes and links no longer work.", retryAfter: 60 };
  if (result.retryAfter) return { error: `Please wait ${waitText(result.retryAfter)} before asking for another code.`, retryAfter: result.retryAfter };
  return { error: result.error };
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
