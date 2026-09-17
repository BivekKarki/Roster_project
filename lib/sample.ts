import "server-only";
import { DEFAULT_PAY_CYCLE, payDatesFor } from "./calc";
import { isoToDb } from "./dates";
import { prisma } from "./db";

/**
 * The example roster from the brief. Rates are left blank on purpose.
 * Pay cycle: fortnights from Mon 14/09/2026 (14/09–27/09), supposed pay Tue 29/09, real pay Tue 06/10.
 */
const CYCLE = { ...DEFAULT_PAY_CYCLE, payDelayDays: 14 };
const SAMPLE_SITES = [
  { employer: "Adairs", location: "Bondi", defaultStart: "07:00", defaultEnd: "09:00" },
  { employer: "Aldi", location: "Edgecliff", defaultStart: "09:00", defaultEnd: "11:00" },
  { employer: "Officeworks", location: "Northrocks", defaultStart: "18:00", defaultEnd: "21:00" },
];
const SAMPLE_DATE = "2026-09-14";

export async function createSampleData(userId: string) {
  const existing = await prisma.site.count({ where: { userId } });
  if (existing > 0) return;
  const pay = payDatesFor(SAMPLE_DATE, CYCLE, 14);
  for (const s of SAMPLE_SITES) {
    await prisma.site.create({
      data: {
        userId, ...s, payFrequency: "FORTNIGHTLY",
        payDelayDays: CYCLE.payDelayDays, payPeriodStart: isoToDb(CYCLE.payPeriodStart),
        payPeriodDays: CYCLE.payPeriodDays, payWeekday: CYCLE.payWeekday, payLateDays: CYCLE.payLateDays,
        shifts: {
          create: {
            userId, employer: s.employer, location: s.location,
            date: isoToDb(SAMPLE_DATE), startTime: s.defaultStart, endTime: s.defaultEnd, status: "SCHEDULED",
            payPeriodStart: isoToDb(pay.periodStart!), payPeriodEnd: isoToDb(pay.periodEnd!),
            officialPayDate: isoToDb(pay.officialPayDate!), expectedPayDate: isoToDb(pay.expectedPayDate),
          },
        },
      },
    });
  }
}
