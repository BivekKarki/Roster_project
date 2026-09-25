import "server-only";
import { cache } from "react";
import { cachedForUser } from "./cache";
import { DEFAULT_FORTNIGHT_START, enrichShift } from "./calc";
import { isoToDb, todayIso } from "./dates";
import { prisma } from "./db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { toSettingsDTO, toShiftDTO, toSiteDTO } from "./mappers";
import type { EnrichedShift, SettingsDTO, ShiftDTO } from "./types";

const ORDER: Prisma.ShiftOrderByWithRelationInput[] = [{ date: "asc" }, { startTime: "asc" }];

/**
 * Loaders wrapped in React `cache` run at most once per request, so a layout and a page that
 * both need settings or employers share a single database round trip. On Vercel every query is
 * a network hop to Neon, so removing duplicates is the cheapest speed-up available.
 */
export const getSettings = cache(async (userId: string): Promise<SettingsDTO> => {
  // Comes from the account query above, so settings cost no query of their own.
  const account = await getAccount(userId);
  if (account?.settings) return account.settings;
  const created = await prisma.settings.create({ data: { userId, fortnightStart: isoToDb(DEFAULT_FORTNIGHT_START) } });
  return toSettingsDTO(created);
});

export const getSites = cache(cachedForUser("sites", async (userId: string) => {
  const rows = await prisma.site.findMany({ where: { userId }, orderBy: [{ employer: "asc" }, { location: "asc" }] });
  return rows.map(toSiteDTO);
}, 3600));

/**
 * One query for everything the shell needs: who you are, your settings, and how many payments
 * are overdue (for the badge). Pages reuse it instead of asking again.
 */
export type AccountDTO = {
  name: string | null;
  email: string;
  createdAt: string;
  emailVerifiedAt: string | null;
  avatarVersion: number | null;
  settings: SettingsDTO | null;
  overdueCount: number;
};

export const getAccount = cache(cachedForUser("account", async (userId: string): Promise<AccountDTO | null> => {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true, email: true, createdAt: true, emailVerifiedAt: true, avatarUpdatedAt: true,
      settings: true,
      _count: { select: { shifts: { where: { status: "COMPLETED", paid: false, expectedPayDate: { lt: isoToDb(todayIso()) } } } } },
    },
  });
  if (!row) return null;
  // Plain values only: cached results are serialised, so Date and Decimal objects can't survive.
  return {
    name: row.name,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    avatarVersion: row.avatarUpdatedAt?.getTime() ?? null,
    settings: row.settings ? toSettingsDTO(row.settings) : null,
    overdueCount: row._count.shifts,
  };
}, 120));

/** Raw rows are cached; the live parts (overdue, working now) are worked out per request. */
const fetchRows = async (userId: string, where: Prisma.ShiftWhereInput, orderBy = ORDER) => {
  const rows = await prisma.shift.findMany({ where: { ...where, userId }, orderBy });
  return rows.map(toShiftDTO);
};

export const enrichAll = (rows: ShiftDTO[], settings: SettingsDTO): EnrichedShift[] => {
  const today = todayIso();
  const now = Date.now();
  return rows.map((r) => enrichShift(r, today, settings.dueSoonDays, now, undefined, settings.autoCompleteShifts));
};

const unpaidRows = cachedForUser("unpaid", (userId: string) =>
  fetchRows(userId, { paid: false, status: { not: "CANCELLED" } }), 600);

/** Worked but unpaid shifts: used by the dashboard and the Unpaid tab. */
export const getUnpaidShifts = cache(async (userId: string) => {
  const [rows, settings] = await Promise.all([unpaidRows(userId), getSettings(userId)]);
  return enrichAll(rows, settings).filter((s) => s.status === "COMPLETED");
});

const rangeRows = cachedForUser("range", (userId: string, from: string, to: string) =>
  fetchRows(userId, { date: { gte: isoToDb(from), lte: isoToDb(to) } }), 600);

/** Shifts between two dates, cached until you change something. */
export const getShiftsBetween = cache(async (userId: string, from: string, to: string) => {
  const [rows, settings] = await Promise.all([rangeRows(userId, from, to), getSettings(userId)]);
  return enrichAll(rows, settings);
});

const noRateCountCached = cachedForUser("no-rate", (userId: string) =>
  prisma.shift.count({ where: { userId, rate: null, status: { not: "CANCELLED" } } }), 600);
export const getNoRateCount = (userId: string) => noRateCountCached(userId);

const unpaidTotalCached = cachedForUser("unpaid-count", (userId: string) =>
  prisma.shift.count({ where: { userId, paid: false, status: { not: "CANCELLED" } } }), 600);
export const getUnpaidCount = (userId: string) => unpaidTotalCached(userId);

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
  return enrichAll(rows.map(toShiftDTO), settings);
}

const openPastRows = cachedForUser("open-past", (userId: string, today: string) =>
  fetchRows(userId, { date: { lte: isoToDb(today) }, status: { in: ["SCHEDULED", "CONFIRMED"] } }), 600);

/** Past shifts still marked Scheduled or Confirmed (used by the dashboard and the Unpaid hint). */
export const getOpenPastShifts = cache(async (userId: string) => {
  const [rows, settings] = await Promise.all([openPastRows(userId, todayIso()), getSettings(userId)]);
  return enrichAll(rows, settings);
});

export const dateRange = (from?: string, to?: string): Prisma.DateTimeFilter | undefined =>
  from || to ? { ...(from ? { gte: isoToDb(from) } : {}), ...(to ? { lte: isoToDb(to) } : {}) } : undefined;
