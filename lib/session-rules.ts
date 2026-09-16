/**
 * Automatic logout rules. Pure functions (no Node APIs) so they run in middleware,
 * on the server and in the browser.
 */

export const DEFAULT_IDLE_MINUTES = 30;
export const WARNING_SECONDS = 60;

export const IDLE_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 1440, label: "1 day" },
  { value: 0, label: "Never (only after the maximum session length)" },
] as const;

export const isIdleOption = (n: number) => IDLE_OPTIONS.some((o) => o.value === n);

/** Hard limit on any session, even for active users. Default 30 days. */
export function sessionMaxDays(env: string | undefined = process.env.SESSION_MAX_DAYS) {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 30;
}

export type SessionTimes = { loginAt?: number; lastActivity?: number; idleMinutes?: number };

/** Why a session should end now, or null if it is still valid. Times are in seconds. */
export function sessionEndReason(t: SessionTimes, nowSec: number, maxDays = sessionMaxDays()): "max-age" | "idle" | null {
  if (typeof t.loginAt === "number" && nowSec - t.loginAt > maxDays * 86_400) return "max-age";
  const idle = t.idleMinutes ?? DEFAULT_IDLE_MINUTES;
  if (idle > 0 && typeof t.lastActivity === "number" && nowSec - t.lastActivity > idle * 60) return "idle";
  return null;
}

/** Browser countdown state. Times are in milliseconds. */
export function idleState(lastActivityMs: number, nowMs: number, idleMinutes: number) {
  if (idleMinutes <= 0) return { phase: "active" as const, secondsLeft: Infinity };
  const left = Math.ceil((lastActivityMs + idleMinutes * 60_000 - nowMs) / 1000);
  if (left <= 0) return { phase: "expired" as const, secondsLeft: 0 };
  if (left <= WARNING_SECONDS) return { phase: "warning" as const, secondsLeft: left };
  return { phase: "active" as const, secondsLeft: left };
}

/** First letter for the avatar: name, else email, else "?" */
export function initialFor(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || "").trim() || (email || "").trim();
  const ch = source ? Array.from(source)[0] : "?";
  return ch.toLocaleUpperCase("en-AU");
}

const AVATAR_COLOURS = ["#1e3a5f", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#15803d", "#1d4ed8", "#9d174d"];

/** Stable background colour per person (all pass contrast with white text). */
export function avatarColour(seed: string | null | undefined) {
  let h = 0;
  for (const c of seed || "?") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}
