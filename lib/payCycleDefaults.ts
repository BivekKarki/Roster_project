import "server-only";
import { DEFAULT_PAY_CYCLE, pickPayCycle } from "./calc";
import { dbToIso } from "./dates";
import { prisma } from "./db";

/**
 * Your pay cycle, taken from your employers: the one most of them use (on a tie, the one you
 * changed last). Falls back to the default when no employer has a pay cycle yet.
 * The dashboard fortnight follows this, so changing a pay cycle moves the fortnight too.
 */
export async function suggestedPayCycle(userId: string) {
  const sites = await prisma.site.findMany({
    where: { userId, payPeriodStart: { not: null }, payWeekday: { not: null } },
    select: { employer: true, location: true, payPeriodStart: true, payPeriodDays: true, payWeekday: true, payLateDays: true, updatedAt: true },
  });
  const picked = pickPayCycle(sites.map((s) => ({
    name: `${s.employer}, ${s.location}`,
    payPeriodStart: dbToIso(s.payPeriodStart!),
    payPeriodDays: s.payPeriodDays,
    payWeekday: s.payWeekday!,
    payLateDays: s.payLateDays,
    updatedAtMs: s.updatedAt.getTime(),
  })));
  if (!picked) return { ...DEFAULT_PAY_CYCLE, fromEmployers: false, employers: [] as string[], otherEmployers: [] as string[] };
  return { ...picked.cycle, fromEmployers: true, employers: picked.employers, otherEmployers: picked.otherEmployers };
}

/** Employers that still use "shift date + N days" instead of a pay cycle. */
export async function employersWithoutPayCycle(userId: string) {
  return prisma.site.findMany({
    where: { userId, OR: [{ payPeriodStart: null }, { payWeekday: null }] },
    select: { id: true, employer: true, location: true, payDelayDays: true },
    orderBy: [{ employer: "asc" }, { location: "asc" }],
  });
}
