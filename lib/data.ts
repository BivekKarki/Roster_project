import "server-only";
import { cache } from "react";
import { DEFAULT_FORTNIGHT_START, enrichShift } from "./calc";
import { isoToDb, todayIso } from "./dates";
import { prisma } from "./db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { toSettingsDTO, toShiftDTO, toSiteDTO } from "./mappers";
import type { EnrichedShift, SettingsDTO } from "./types";

const ORDER: Prisma.ShiftOrderByWithRelationInput[] = [{ date: "asc" }, { startTime: "asc" }];

/**
 * Loaders wrapped in React `cache` run at most once per request, so a layout and a page that
 * both need settings or employers share a single database round trip. On Vercel every query is
 * a network hop to Neon, so removing duplicates is the cheapest speed-up available.
 */
export const getSettings = cache(async (userId: string): Promise<SettingsDTO> => {
  // Comes from the account query above, so settings cost no query of their own.
  const account = await getAccount(userId);
  if (account?.settings) return toSettingsDTO(account.settings);
  const created = await prisma.settings.create({ data: { userId, fortnightStart: isoToDb(DEFAULT_FORTNIGHT_START) } });
  return toSettingsDTO(created);
});

export const getSites = cache(async (userId: string) => {
  const rows = await prisma.site.findMany({ where: { userId }, orderBy: [{ employer: "asc" }, { location: "asc" }] });
  return rows.map(toSiteDTO);
});

/**
 * One query for everything the shell needs: who you are, your settings, and how many payments
 * are overdue (for the badge). Pages reuse it instead of asking again.
 */
export const getAccount = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true, email: true, createdAt: true, emailVerifiedAt: true, avatarUpdatedAt: true,
      settings: true,
      _count: { select: { shifts: { where: { status: "COMPLETED", paid: false, expectedPayDate: { lt: isoToDb(todayIso()) } } } } },
    },
  });
});

/** Completed but unpaid shifts: used by the dashboard, the Unpaid tab and the nav badge. */
export const getUnpaidShifts = cache(async (userId: string) => {
  const settings = await getSettings(userId);
  return findShifts(userId, { status: "COMPLETED", paid: false }, settings);
});

export async function findShifts(
  userId: string,
  where: Prisma.ShiftWhereInput,
  settings: SettingsDTO,
  options: { orderBy?: Prisma.ShiftOrderByWithRelationInput[]; take?: number; skip?: number } = {},
): Promise<EnrichedShift[]> {
  const rows = await prisma.shift.findMany({
    where: { ...where, userId },
    orderBy: options.orderBy ?? ORDER,
    take: options.take,
    skip: options.skip,
  });
  const today = todayIso();
  return rows.map((r) => enrichShift(toShiftDTO(r), today, settings.dueSoonDays));
}

/** Past shifts still marked Scheduled or Confirmed (used by the dashboard and the Unpaid hint). */
export const getOpenPastShifts = cache(async (userId: string) => {
  const settings = await getSettings(userId);
  return findShifts(userId, { date: { lte: isoToDb(todayIso()) }, status: { in: ["SCHEDULED", "CONFIRMED"] } }, settings);
});

export const dateRange = (from?: string, to?: string): Prisma.DateTimeFilter | undefined =>
  from || to ? { ...(from ? { gte: isoToDb(from) } : {}), ...(to ? { lte: isoToDb(to) } : {}) } : undefined;
