import "server-only";
import { enrichShift } from "./calc";
import { isoToDb, mondayOf, todayIso } from "./dates";
import { prisma } from "./db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { toSettingsDTO, toShiftDTO, toSiteDTO } from "./mappers";
import type { EnrichedShift, SettingsDTO } from "./types";

const ORDER: Prisma.ShiftOrderByWithRelationInput[] = [{ date: "asc" }, { startTime: "asc" }];

export async function getSettings(userId: string): Promise<SettingsDTO> {
  const row = await prisma.settings.upsert({
    where: { userId },
    update: {},
    create: { userId, fortnightStart: isoToDb(mondayOf(todayIso())) },
  });
  return toSettingsDTO(row);
}

export async function getSites(userId: string) {
  const rows = await prisma.site.findMany({ where: { userId }, orderBy: [{ employer: "asc" }, { location: "asc" }] });
  return rows.map(toSiteDTO);
}

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

export const dateRange = (from?: string, to?: string): Prisma.DateTimeFilter | undefined =>
  from || to ? { ...(from ? { gte: isoToDb(from) } : {}), ...(to ? { lte: isoToDb(to) } : {}) } : undefined;
