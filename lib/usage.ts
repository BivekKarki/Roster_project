import "server-only";
import { prisma } from "./db";

/** How many shifts use each site, for ordering quick picks. */
export async function siteUsage(userId: string) {
  const rows = await prisma.shift.groupBy({ by: ["siteId"], where: { userId, siteId: { not: null } }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.siteId as string, r._count._all]));
}
