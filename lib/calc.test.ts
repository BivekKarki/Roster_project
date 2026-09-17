import assert from "node:assert/strict";
import { test } from "node:test";
import { calcHours, calcPay, enrichShift, payDatesFor, splitPayment } from "./calc";
import type { PayCycle, ShiftDTO } from "./types";

const fortnightTuesdayLate7: PayCycle = {
  payPeriodStart: "2026-09-07", payPeriodDays: 14, payWeekday: 2, payLateDays: 7, payDelayDays: 14,
};

test("pay cycle: shifts in 07/09–20/09 are officially paid Tue 22/09, expected Tue 29/09", () => {
  for (const date of ["2026-09-07", "2026-09-08", "2026-09-14", "2026-09-20"]) {
    assert.deepEqual(payDatesFor(date, fortnightTuesdayLate7, 14), {
      periodStart: "2026-09-07", periodEnd: "2026-09-20", officialPayDate: "2026-09-22", expectedPayDate: "2026-09-29",
    }, date);
  }
});

test("pay cycle: next period starts 21/09", () => {
  assert.deepEqual(payDatesFor("2026-09-21", fortnightTuesdayLate7, 14), {
    periodStart: "2026-09-21", periodEnd: "2026-10-04", officialPayDate: "2026-10-06", expectedPayDate: "2026-10-13",
  });
});

test("pay cycle: dates before the anchor use the earlier period", () => {
  assert.deepEqual(payDatesFor("2026-09-06", fortnightTuesdayLate7, 14), {
    periodStart: "2026-08-24", periodEnd: "2026-09-06", officialPayDate: "2026-09-08", expectedPayDate: "2026-09-15",
  });
});

test("pay cycle: pay day falling on the day after the period ends", () => {
  // period 07/09 (Mon) – 20/09 (Sun); Monday pay day = 21/09
  const cycle = { ...fortnightTuesdayLate7, payWeekday: 1, payLateDays: 0 };
  assert.equal(payDatesFor("2026-09-10", cycle, 14).officialPayDate, "2026-09-21");
});

test("pay cycle: weekly, Thursday, on time", () => {
  const weekly: PayCycle = { payPeriodStart: "2026-09-07", payPeriodDays: 7, payWeekday: 4, payLateDays: 0, payDelayDays: 14 };
  assert.deepEqual(payDatesFor("2026-09-16", weekly, 14), {
    periodStart: "2026-09-14", periodEnd: "2026-09-20", officialPayDate: "2026-09-24", expectedPayDate: "2026-09-24",
  });
});

test("no pay cycle: falls back to shift date + delay", () => {
  assert.deepEqual(payDatesFor("2026-09-14", { ...fortnightTuesdayLate7, payWeekday: null, payDelayDays: 10 }, 14), {
    periodStart: null, periodEnd: null, officialPayDate: null, expectedPayDate: "2026-09-24",
  });
  assert.equal(payDatesFor("2026-09-14", null, 14).expectedPayDate, "2026-09-28");
});

test("hours and pay", () => {
  assert.equal(calcHours("07:00", "09:00", 0), 2);
  assert.equal(calcHours("22:00", "06:00", 30), 7.5);
  assert.equal(calcPay(3, 28, null, null), 84);
  assert.equal(calcPay(7.5, 30, 7, 1.5), 232.5);
  assert.equal(calcPay(2, null, null, null), null);
});

test("lump sum split totals exactly", () => {
  const parts = splitPayment(300, [50, 84, 232.5]);
  assert.equal(Math.round(parts.reduce<number>((a, b) => a + (b ?? 0), 0) * 100) / 100, 300);
});

test("overdue uses the expected (late) date, and lateness vs official is reported", () => {
  const shift: ShiftDTO = {
    id: "1", siteId: null, employer: "Adairs", location: "Bondi", date: "2026-09-14", startTime: "07:00", endTime: "09:00",
    breakMins: 0, rate: 25, otThreshold: null, otMultiplier: null, status: "COMPLETED", autoStatus: true, notes: "",
    payPeriodStart: "2026-09-07", payPeriodEnd: "2026-09-20", officialPayDate: "2026-09-22", expectedPayDate: "2026-09-29",
    paid: false, actualPayDate: null, actualAmount: null, payNotes: "",
  };
  assert.equal(enrichShift(shift, "2026-09-25", 3).payState, "waiting");
  assert.equal(enrichShift(shift, "2026-09-26", 3).payState, "soon");
  assert.equal(enrichShift(shift, "2026-09-30", 3).payState, "overdue");
  assert.equal(enrichShift(shift, "2026-09-25", 3).expectedLateDays, 7);
  const paid = enrichShift({ ...shift, paid: true, actualPayDate: "2026-09-29" }, "2026-09-30", 3);
  assert.equal(paid.paidDaysAfterOfficial, 7);
});

test("user's payroll: 14/09–27/09 is supposed to be paid Tue 29/09 but really arrives Tue 06/10", () => {
  const cycle: PayCycle = { payPeriodStart: "2026-09-14", payPeriodDays: 14, payWeekday: 2, payLateDays: 7, payDelayDays: 14 };
  for (const date of ["2026-09-14", "2026-09-15", "2026-09-20", "2026-09-21", "2026-09-27"]) {
    assert.deepEqual(payDatesFor(date, cycle, 14), {
      periodStart: "2026-09-14", periodEnd: "2026-09-27", officialPayDate: "2026-09-29", expectedPayDate: "2026-10-06",
    }, date);
  }
  assert.deepEqual(payDatesFor("2026-09-28", cycle, 14), {
    periodStart: "2026-09-28", periodEnd: "2026-10-11", officialPayDate: "2026-10-13", expectedPayDate: "2026-10-20",
  });
  // Without a cycle every shift would be paid a different day (the reported problem)
  assert.notEqual(payDatesFor("2026-09-14", null, 14).expectedPayDate, payDatesFor("2026-09-20", null, 14).expectedPayDate);
});

test("default pay cycle matches the user's payroll", async () => {
  const { DEFAULT_PAY_CYCLE } = await import("./calc");
  const pay = payDatesFor("2026-09-16", { ...DEFAULT_PAY_CYCLE, payDelayDays: 14 }, 14);
  assert.equal(pay.officialPayDate, "2026-09-29");
  assert.equal(pay.expectedPayDate, "2026-10-06");
});
