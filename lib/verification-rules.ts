/** Email verification rules. Pure (no Node APIs) so they can be unit tested. */

export const CODE_LENGTH = 6;
export const VERIFY_TTL_MINUTES = 30;
export const LOGIN_TICKET_TTL_SECONDS = 120;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_SENDS_PER_HOUR = 5;

export const isCodeFormat = (code: string) => new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);

/** Accepts "123 456", "123-456" and similar paste formats. */
export const normaliseCode = (raw: string) => raw.replace(/[\s-]/g, "");

export type ResendDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number; reason: "cooldown" | "hourly-limit" };

/** Whether another email may be sent, given when previous ones were sent (ms timestamps). */
export function resendDecision(sentAtMs: number[], nowMs: number): ResendDecision {
  const sorted = [...sentAtMs].sort((a, b) => b - a);
  const last = sorted[0];
  if (last !== undefined && nowMs - last < RESEND_COOLDOWN_SECONDS * 1000) {
    return { allowed: false, reason: "cooldown", retryAfterSeconds: Math.ceil((last + RESEND_COOLDOWN_SECONDS * 1000 - nowMs) / 1000) };
  }
  const lastHour = sorted.filter((t) => nowMs - t < 3_600_000);
  if (lastHour.length >= MAX_SENDS_PER_HOUR) {
    const oldest = lastHour[lastHour.length - 1];
    return { allowed: false, reason: "hourly-limit", retryAfterSeconds: Math.ceil((oldest + 3_600_000 - nowMs) / 1000) };
  }
  return { allowed: true };
}

/** "j***@test.com" style masking for places where the email shouldn't be shown in full. */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(user.length - 1, 5)))}@${domain}`;
}

export const waitText = (seconds: number) =>
  seconds >= 120 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} second${seconds === 1 ? "" : "s"}`;
