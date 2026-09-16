import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./db";
import { sendEmail, verificationEmail } from "./email";
import {
  CODE_LENGTH, LOGIN_TICKET_TTL_SECONDS, MAX_CODE_ATTEMPTS, VERIFY_TTL_MINUTES, isCodeFormat, normaliseCode, resendDecision,
  type ResendDecision,
} from "./verification-rules";

/** Codes and tokens are stored as HMACs keyed with AUTH_SECRET, never in plain text. */
function hmac(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(value).digest("hex");
}

const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const verificationRequired = () => process.env.REQUIRE_EMAIL_VERIFICATION !== "false";

/** Base URL for links in emails: APP_URL if set, otherwise the address the request came in on. */
async function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function canSendVerification(userId: string): Promise<ResendDecision> {
  const recent = await prisma.emailVerification.findMany({
    where: { userId, purpose: "EMAIL_VERIFY", createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    select: { createdAt: true },
  });
  return resendDecision(recent.map((r) => r.createdAt.getTime()), Date.now());
}

/**
 * Creates a fresh code + link (older ones stop working) and emails them.
 * Callers must check canSendVerification first.
 */
export async function sendVerificationEmail(user: { id: string; email: string; name: string | null }) {
  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  const [, , record] = await prisma.$transaction([
    prisma.emailVerification.updateMany({
      where: { userId: user.id, purpose: "EMAIL_VERIFY", usedAt: null },
      data: { usedAt: now },
    }),
    prisma.emailVerification.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date(now.getTime() - 86_400_000) } } }),
    prisma.emailVerification.create({
      data: {
        userId: user.id,
        purpose: "EMAIL_VERIFY",
        codeHash: hmac(`code:${user.id}:${code}`),
        tokenHash: hmac(`link:${token}`),
        expiresAt: new Date(now.getTime() + VERIFY_TTL_MINUTES * 60_000),
      },
    }),
  ]);

  const link = `${await appUrl()}/verify-email/confirm?token=${encodeURIComponent(token)}`;
  try {
    await sendEmail(verificationEmail({ to: user.email, name: user.name, code, link, minutes: VERIFY_TTL_MINUTES }));
  } catch (error) {
    // The email never arrived, so don't let this attempt count towards the resend wait.
    await prisma.emailVerification.delete({ where: { id: record.id } }).catch(() => {});
    throw error;
  }
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; error: "invalid" | "expired" | "too-many" | "already-verified" | "no-code"; attemptsLeft?: number };

async function markVerified(recordId: string, userId: string) {
  const now = new Date();
  // updateMany with usedAt: null makes the code single-use even if two requests race.
  const [used] = await prisma.$transaction([
    prisma.emailVerification.updateMany({ where: { id: recordId, usedAt: null }, data: { usedAt: now } }),
    prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } }),
  ]);
  return used.count === 1;
}

export async function verifyCode(email: string, rawCode: string): Promise<VerifyResult> {
  const code = normaliseCode(rawCode);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
  if (!user) return { ok: false, error: "invalid" };
  if (user.emailVerifiedAt) return { ok: false, error: "already-verified" };

  const record = await prisma.emailVerification.findFirst({
    where: { userId: user.id, purpose: "EMAIL_VERIFY", usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, error: "no-code" };
  if (record.expiresAt < new Date()) return { ok: false, error: "expired" };
  if (record.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, error: "too-many" };

  if (!isCodeFormat(code) || !record.codeHash || !sameHash(record.codeHash, hmac(`code:${user.id}:${code}`))) {
    const updated = await prisma.emailVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    const attemptsLeft = Math.max(0, MAX_CODE_ATTEMPTS - updated.attempts);
    return attemptsLeft === 0 ? { ok: false, error: "too-many" } : { ok: false, error: "invalid", attemptsLeft };
  }

  return (await markVerified(record.id, user.id)) ? { ok: true, userId: user.id } : { ok: false, error: "invalid" };
}

export async function verifyLinkToken(token: string): Promise<VerifyResult> {
  if (!token || token.length > 200) return { ok: false, error: "invalid" };
  const record = await prisma.emailVerification.findUnique({
    where: { tokenHash: hmac(`link:${token}`) },
    include: { user: { select: { emailVerifiedAt: true } } },
  });
  if (!record || record.purpose !== "EMAIL_VERIFY") return { ok: false, error: "invalid" };
  if (record.user.emailVerifiedAt) return { ok: false, error: "already-verified" };
  if (record.usedAt) return { ok: false, error: "expired" }; // replaced by a newer email
  if (record.expiresAt < new Date()) return { ok: false, error: "expired" };
  return (await markVerified(record.id, record.userId)) ? { ok: true, userId: record.userId } : { ok: false, error: "invalid" };
}

/** A single-use ticket that lets the user be signed in right after verifying, without retyping the password. */
export async function createLoginTicket(userId: string) {
  const ticket = randomBytes(32).toString("base64url");
  await prisma.emailVerification.create({
    data: {
      userId,
      purpose: "LOGIN_TICKET",
      tokenHash: hmac(`ticket:${ticket}`),
      expiresAt: new Date(Date.now() + LOGIN_TICKET_TTL_SECONDS * 1000),
    },
  });
  return ticket;
}

export async function consumeLoginTicket(ticket: string) {
  if (!ticket || ticket.length > 200) return null;
  const record = await prisma.emailVerification.findUnique({ where: { tokenHash: hmac(`ticket:${ticket}`) } });
  if (!record || record.purpose !== "LOGIN_TICKET" || record.usedAt || record.expiresAt < new Date()) return null;
  const used = await prisma.emailVerification.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) return null;
  return prisma.user.findUnique({
    where: { id: record.userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true, settings: { select: { idleTimeoutMinutes: true } } },
  });
}
