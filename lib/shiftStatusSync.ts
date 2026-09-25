import "server-only";
import { cache } from "react";
import { bumpUser, cachedForUser } from "./cache";
import { getSettings } from "./data";
import { dbToIso, isoToDb, todayIso } from "./dates";
import { prisma } from "./db";
import { appTimeZone, shiftPhase, shiftWindow } from "./shift-time";

/**
 * Marks your Scheduled/Confirmed shifts as Completed once their end time has passed.
 * Runs at the start of each request (once per request thanks to React cache), before any
 * page reads shifts, so every screen agrees. Shifts whose status you set by hand
 * (autoStatus = false) and Cancelled shifts are left alone.
 */
const finishedCandidates = cachedForUser("finished-candidates", async (userId: string, today: string, nowTime: string) => {
  const rows = await prisma.shift.findMany({
    where: {
      userId,
      autoStatus: true,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      // Only shifts that could have finished: earlier days, or today with an end time already past.
      OR: [{ date: { lt: isoToDb(today) } }, { AND: [{ date: isoToDb(today) }, { endTime: { lte: nowTime } }] }],
    },
    select: { id: true, date: true, startTime: true, endTime: true },
  });
  // Cached values are serialised, so hand back plain strings rather than Date objects.
  return rows.map((r) => ({ id: r.id, date: dbToIso(r.date), startTime: r.startTime, endTime: r.endTime }));
}, 60);

export const syncShiftStatuses = cache(async (userId: string) => {
  const settings = await getSettings(userId); // cached: no extra query
  if (!settings.autoCompleteShifts) return 0;

  const timeZone = appTimeZone();
  const now = Date.now();
  const today = todayIso(timeZone);
  const nowTime = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  // Cached for a minute and thrown away on any write, so a refresh usually costs no query.
  const candidates = await finishedCandidates(userId, today, nowTime);
  const finished = candidates
    .filter((s) => shiftPhase(now, shiftWindow(s.date, s.startTime, s.endTime, timeZone)) === "finished")
    .map((s) => s.id);
  if (finished.length === 0) return 0;

  const result = await prisma.shift.updateMany({
    where: { id: { in: finished }, userId, autoStatus: true, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    data: { status: "COMPLETED" },
  });
  if (result.count > 0) bumpUser(userId); // statuses changed: drop this user's cached data
  return result.count;
});
