/**
 * Pure calculation logic shared by server pages and client forms.
 * No database or framework imports here.
 */
import { addDays, dayName, diffDays, isIsoDate, mondayOf, MONTH_NAMES, weekdayOf } from "./dates";
import { fmtDate, round2 } from "./format";
import { appTimeZone, shiftPhase, shiftWindow } from "./shift-time";
import type { EnrichedShift, PayCycle, PayDates, PeriodKind, SettingsDTO, ShiftDTO } from "./types";

export const DEFAULT_FORTNIGHT_START = "2026-09-14";

/**
 * Default pay cycle: fortnights starting Mon 14/09/2026 (14/09–27/09, 28/09–11/10, …),
 * supposed to be paid the Tuesday after the fortnight ends (29/09), but payroll usually pays
 * one week later (06/10).
 */
export const DEFAULT_PAY_CYCLE = { payPeriodStart: DEFAULT_FORTNIGHT_START, payPeriodDays: 14, payWeekday: 2, payLateDays: 7 };

export const hasPayCycle = (c: PayCycle | null | undefined): c is PayCycle & { payPeriodStart: string; payWeekday: number } =>
  !!c && isIsoDate(c.payPeriodStart) && c.payWeekday !== null && c.payWeekday >= 0 && c.payWeekday <= 6 && c.payPeriodDays > 0;

/**
 * Pay dates for a shift.
 * With a pay cycle: the shift belongs to a fixed-length period counted from payPeriodStart
 * (dates before the anchor work too). Every shift in the same period gets the same dates:
 *  - supposed pay date (officialPayDate): the first payWeekday AFTER the period ends
 *  - real pay date (expectedPayDate): supposed + the days payroll is usually late
 * Without a cycle: real pay date = shift date + fallback delay, and there is no supposed date.
 */
export function payDatesFor(shiftDate: string, cycle: PayCycle | null | undefined, fallbackDelayDays: number): PayDates {
  if (!hasPayCycle(cycle)) {
    const delay = cycle?.payDelayDays ?? fallbackDelayDays;
    return { periodStart: null, periodEnd: null, officialPayDate: null, expectedPayDate: addDays(shiftDate, delay) };
  }
  const length = cycle.payPeriodDays;
  const index = Math.floor(diffDays(shiftDate, cycle.payPeriodStart) / length);
  const periodStart = addDays(cycle.payPeriodStart, index * length);
  const periodEnd = addDays(periodStart, length - 1);
  const dayAfterEnd = addDays(periodEnd, 1);
  const officialPayDate = addDays(dayAfterEnd, (cycle.payWeekday - weekdayOf(dayAfterEnd) + 7) % 7);
  const expectedPayDate = addDays(officialPayDate, cycle.payLateDays || 0);
  return { periodStart, periodEnd, officialPayDate, expectedPayDate };
}

export type PayCycleCandidate = {
  name: string;
  payPeriodStart: string;
  payPeriodDays: number;
  payWeekday: number;
  payLateDays: number;
  /** when the employer was last saved (ms) */
  updatedAtMs: number;
};

/**
 * The pay cycle to use for the dashboard fortnight and as the suggestion for new employers:
 * the one most employers share; on a tie, the one changed most recently.
 * Two cycles that produce the same fortnights (e.g. starting 07/09 or 21/09) count as the same.
 */
export function pickPayCycle(candidates: PayCycleCandidate[]) {
  if (candidates.length === 0) return null;
  const normalise = (c: PayCycleCandidate) => {
    // Move the start to the earliest equivalent date on/after 2000-01-03 so equivalent anchors match.
    const offset = ((diffDays(c.payPeriodStart, "2000-01-03") % c.payPeriodDays) + c.payPeriodDays) % c.payPeriodDays;
    return `${c.payPeriodDays}|${offset}|${c.payWeekday}|${c.payLateDays}`;
  };
  const groups = new Map<string, { members: PayCycleCandidate[]; latest: PayCycleCandidate }>();
  for (const c of candidates) {
    const key = normalise(c);
    const g = groups.get(key);
    if (!g) groups.set(key, { members: [c], latest: c });
    else {
      g.members.push(c);
      if (c.updatedAtMs > g.latest.updatedAtMs) g.latest = c;
    }
  }
  const ranked = [...groups.values()].sort((a, b) => b.members.length - a.members.length || b.latest.updatedAtMs - a.latest.updatedAtMs);
  const winner = ranked[0];
  const { payPeriodStart, payPeriodDays, payWeekday, payLateDays } = winner.latest;
  return {
    cycle: { payPeriodStart, payPeriodDays, payWeekday, payLateDays },
    employers: winner.members.map((m) => m.name),
    otherEmployers: ranked.slice(1).flatMap((g) => g.members.map((m) => m.name)),
  };
}

/** Paid hours between two "HH:MM" times minus an unpaid break. Handles overnight shifts. */
export function calcHours(start: string, end: string, breakMins: number) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  mins -= Number(breakMins) || 0;
  return Math.max(0, round2(mins / 60));
}

/** Expected pay = hours x rate, with optional per-shift overtime rule. Null when no rate. */
export function calcPay(hours: number, rate: number | null, otThreshold: number | null, otMultiplier: number | null) {
  if (rate === null || Number.isNaN(rate)) return null;
  if (otThreshold !== null && otThreshold > 0 && hours > otThreshold) {
    return round2(otThreshold * rate + (hours - otThreshold) * rate * (otMultiplier || 1));
  }
  return round2(hours * rate);
}

export function enrichShift(s: ShiftDTO, today: string, dueSoonDays: number, nowMs = Date.now(), timeZone = appTimeZone()): EnrichedShift {
  const hours = calcHours(s.startTime, s.endTime, s.breakMins);
  const pay = calcPay(hours, s.rate, s.otThreshold, s.otMultiplier);
  const paidAmount = s.paid ? (s.actualAmount ?? pay ?? 0) : 0;
  const difference = s.paid && s.actualAmount !== null && pay !== null ? round2(s.actualAmount - pay) : null;

  let payState: EnrichedShift["payState"] = null;
  let daysOverdue = 0;
  let daysUntilDue: number | null = null;
  if (s.status === "COMPLETED") {
    if (s.paid) payState = "paid";
    else if (!s.expectedPayDate || !isIsoDate(s.expectedPayDate)) payState = "waiting";
    else {
      const d = diffDays(today, s.expectedPayDate);
      if (d > 0) {
        payState = "overdue";
        daysOverdue = d;
      } else {
        daysUntilDue = -d;
        payState = -d <= dueSoonDays ? "soon" : "waiting";
      }
    }
  }
  const expectedLateDays = s.officialPayDate && s.expectedPayDate ? diffDays(s.expectedPayDate, s.officialPayDate) : null;
  const paidDaysAfterOfficial = s.paid && s.officialPayDate && s.actualPayDate ? diffDays(s.actualPayDate, s.officialPayDate) : null;
  return {
    ...s, day: dayName(s.date), hours, pay, paidAmount, difference, payState, daysOverdue, daysUntilDue,
    phase: s.startTime && s.endTime ? shiftPhase(nowMs, shiftWindow(s.date, s.startTime, s.endTime, timeZone)) : "upcoming",
    expectedLateDays, paidDaysAfterOfficial,
  };
}

const sum = <T,>(arr: T[], f: (x: T) => number | null | undefined) => round2(arr.reduce((a, x) => a + (f(x) || 0), 0));
export { sum };

export type Summary = {
  shifts: number;
  hours: number;
  expected: number;
  paid: number;
  unpaidAmount: number;
  unpaidCount: number;
  completedCount: number;
  upcoming: number;
  upcomingHours: number;
  missingRate: number;
};

export function summarize(list: EnrichedShift[]): Summary {
  const active = list.filter((s) => s.status !== "CANCELLED");
  const completed = active.filter((s) => s.status === "COMPLETED");
  const unpaid = completed.filter((s) => !s.paid);
  return {
    shifts: active.length,
    hours: sum(active, (s) => s.hours),
    expected: sum(active, (s) => s.pay),
    paid: sum(completed.filter((s) => s.paid), (s) => s.paidAmount),
    unpaidAmount: sum(unpaid, (s) => s.pay),
    unpaidCount: unpaid.length,
    completedCount: completed.length,
    upcoming: sum(active.filter((s) => s.status !== "COMPLETED"), (s) => s.pay),
    upcomingHours: sum(active.filter((s) => s.status !== "COMPLETED"), (s) => s.hours),
    missingRate: active.filter((s) => s.pay === null).length,
  };
}

export function summarizeByEmployer(list: EnrichedShift[]) {
  const names = [...new Set(list.map((s) => s.employer))];
  return names
    .map((name) => ({ name, ...summarize(list.filter((s) => s.employer === name)) }))
    .filter((e) => e.shifts > 0)
    .sort((a, b) => b.expected - a.expected || b.hours - a.hours || a.name.localeCompare(b.name));
}

export type Period = { kind: PeriodKind; offset: number; start: string; end: string; label: string };

export function periodRange(kind: PeriodKind, offset: number, settings: Pick<SettingsDTO, "fortnightStart">, today: string): Period {
  if (kind === "week") {
    const start = addDays(mondayOf(today), 7 * offset);
    const end = addDays(start, 6);
    return { kind, offset, start, end, label: `${fmtDate(start)} to ${fmtDate(end)}` };
  }
  if (kind === "fortnight") {
    const base = isIsoDate(settings.fortnightStart) ? settings.fortnightStart : DEFAULT_FORTNIGHT_START;
    const index = Math.floor(diffDays(today, base) / 14) + offset;
    const start = addDays(base, index * 14);
    const end = addDays(start, 13);
    return { kind, offset, start, end, label: `${fmtDate(start)} to ${fmtDate(end)}` };
  }
  const [y, m] = today.split("-").map(Number);
  if (kind === "month") {
    const first = new Date(Date.UTC(y, m - 1 + offset, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    return {
      kind, offset,
      start: first.toISOString().slice(0, 10),
      end: last.toISOString().slice(0, 10),
      label: `${MONTH_NAMES[first.getUTCMonth()]} ${first.getUTCFullYear()}`,
    };
  }
  // Australian financial year: 1 July to 30 June
  const fy = (m >= 7 ? y : y - 1) + offset;
  const fyLabel = `FY ${fy}–${String(fy + 1).slice(2)}`;
  if (offset === 0) return { kind, offset, start: `${fy}-07-01`, end: today, label: `${fyLabel}, year to date` };
  return { kind, offset, start: `${fy}-07-01`, end: `${fy + 1}-06-30`, label: `${fyLabel}, full year` };
}

export const PAY_STATE_META = {
  paid: { icon: "🟢", label: "Paid", card: "border-green-300 bg-green-50" },
  soon: { icon: "🟡", label: "Payment due soon", card: "border-yellow-400 bg-yellow-50" },
  overdue: { icon: "🔴", label: "Payment overdue", card: "border-red-300 bg-red-50" },
  waiting: { icon: "⚪", label: "Not due yet", card: "border-slate-200 bg-white" },
} as const;

/** Split a lump-sum payment across shifts in proportion to expected pay. Last shift absorbs rounding. */
export function splitPayment(total: number, expected: number[]) {
  const sumExpected = expected.reduce((a, b) => a + b, 0);
  if (sumExpected <= 0) return expected.map(() => null);
  let running = 0;
  return expected.map((e, i) => {
    if (i === expected.length - 1) return round2(total - running);
    const part = round2((total * e) / sumExpected);
    running = round2(running + part);
    return part;
  });
}
