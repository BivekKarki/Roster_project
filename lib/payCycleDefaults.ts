import "server-only";
import { DEFAULT_PAY_CYCLE } from "./calc";
import { dbToIso } from "./dates";
import { prisma } from "./db";

/**
 * The pay cycle to suggest: the one most of your employers already use, otherwise the default
 * (fortnights from 14/09/2026, Tuesday after, 7 days late).
 */
export async function suggestedPayCycle(userId: string) {
  const sites = await prisma.site.findMany({
    where: { userId, payPeriodStart: { not: null }, payWeekday: { not: null } },
    select: { payPeriodStart: true, payPeriodDays: true, payWeekday: true, payLateDays: true },
  });
  if (sites.length === 0) return { ...DEFAULT_PAY_CYCLE, fromEmployers: false };
  const counts = new Map<string, { n: number; cycle: typeof DEFAULT_PAY_CYCLE }>();
  for (const s of sites) {
    const cycle = { payPeriodStart: dbToIso(s.payPeriodStart!), payPeriodDays: s.payPeriodDays, payWeekday: s.payWeekday!, payLateDays: s.payLateDays };
    const key = JSON.stringify(cycle);
    counts.set(key, { n: (counts.get(key)?.n ?? 0) + 1, cycle });
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return { ...best.cycle, fromEmployers: true };
}

/** Employers that still use "shift date + N days" instead of a pay cycle. */
export async function employersWithoutPayCycle(userId: string) {
  return prisma.site.findMany({
    where: { userId, OR: [{ payPeriodStart: null }, { payWeekday: null }] },
    select: { id: true, employer: true, location: true, payDelayDays: true },
    orderBy: [{ employer: "asc" }, { location: "asc" }],
  });
}
