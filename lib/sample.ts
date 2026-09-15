import "server-only";
import { isoToDb } from "./dates";
import { prisma } from "./db";

/** The three example shifts from the original brief. Rates are left blank on purpose. */
const SAMPLE_SITES = [
  { employer: "Adairs", location: "Bondi", defaultStart: "07:00", defaultEnd: "09:00" },
  { employer: "Aldi", location: "Edgecliff", defaultStart: "09:00", defaultEnd: "11:00" },
  { employer: "Officeworks", location: "Northrocks", defaultStart: "18:00", defaultEnd: "21:00" },
];

export async function createSampleData(userId: string) {
  const existing = await prisma.site.count({ where: { userId } });
  if (existing > 0) return;
  for (const s of SAMPLE_SITES) {
    await prisma.site.create({
      data: {
        userId, ...s, payFrequency: "FORTNIGHTLY", payDelayDays: 14,
        shifts: {
          create: {
            userId, employer: s.employer, location: s.location,
            date: isoToDb("2026-09-14"), startTime: s.defaultStart, endTime: s.defaultEnd,
            status: "SCHEDULED", expectedPayDate: isoToDb("2026-09-28"),
          },
        },
      },
    });
  }
}
