import "server-only";
import { prisma } from "./db";

export async function siteShiftCounts(userId: string) {
  const [all, blank, unpaid] = await Promise.all([
    prisma.shift.groupBy({ by: ["employer", "location"], where: { userId }, _count: { _all: true } }),
    prisma.shift.groupBy({ by: ["employer", "location"], where: { userId, rate: null, status: { not: "CANCELLED" } }, _count: { _all: true } }),
    prisma.shift.groupBy({ by: ["employer", "location"], where: { userId, paid: false, status: { not: "CANCELLED" } }, _count: { _all: true } }),
  ]);
  const toMap = (rows: typeof all) => Object.fromEntries(rows.map((r) => [`${r.employer}|${r.location}`, r._count._all]));
  return { shiftCounts: toMap(all), blankRateCounts: toMap(blank), unpaidCounts: toMap(unpaid) };
}
