import "server-only";
import { cache } from "react";
import { DEFAULT_PAY_CYCLE, pickPayCycle } from "./calc";
import { getSites } from "./data";

/**
 * Your pay cycle, taken from your employers: the one most of them use (on a tie, the one you
 * changed last). Falls back to the default when no employer has a pay cycle yet.
 * Reads the cached employer list, so it costs no extra database query.
 */
export const suggestedPayCycle = cache(async (userId: string) => {
  const sites = await getSites(userId);
  const picked = pickPayCycle(sites
    .filter((s) => s.payPeriodStart !== null && s.payWeekday !== null)
    .map((s) => ({
      name: `${s.employer}, ${s.location}`,
      payPeriodStart: s.payPeriodStart as string,
      payPeriodDays: s.payPeriodDays,
      payWeekday: s.payWeekday as number,
      payLateDays: s.payLateDays,
      updatedAtMs: s.updatedAtMs,
    })));
  if (!picked) return { ...DEFAULT_PAY_CYCLE, fromEmployers: false, employers: [] as string[], otherEmployers: [] as string[] };
  return { ...picked.cycle, fromEmployers: true, employers: picked.employers, otherEmployers: picked.otherEmployers };
});

/** Employers that still use "shift date + N days" instead of a pay cycle. */
export async function employersWithoutPayCycle(userId: string) {
  const sites = await getSites(userId);
  return sites.filter((s) => s.payPeriodStart === null || s.payWeekday === null);
}
