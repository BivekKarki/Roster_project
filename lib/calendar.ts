/** Month calendar helpers. Pure, shared by server and client. */
import { addDays, isIsoDate, mondayOf, MONTH_NAMES } from "./dates";

export const isMonthKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export const monthOf = (iso: string) => iso.slice(0, 7);

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** First and last calendar dates of a month */
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { first, last };
}

/**
 * The dates shown in a Monday-first month grid: whole weeks from the Monday on/before the 1st
 * to the Sunday on/after the last day (5 or 6 rows).
 */
export function monthGrid(month: string) {
  const { first, last } = monthBounds(month);
  const start = mondayOf(first);
  const end = addDays(mondayOf(last), 6);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return { start, end, days, weeks: days.length / 7 };
}

/** Distinct, colour-blind-friendlier dot colours (Okabe–Ito based, darkened for contrast). */
export const DOT_COLOURS = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#7a5c00", "#6b7280"];

/** Gives each employer a stable colour by alphabetical order, so there are no clashes for up to 8 employers. */
export function employerColours(names: string[]) {
  const sorted = [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return Object.fromEntries(sorted.map((n, i) => [n, DOT_COLOURS[i % DOT_COLOURS.length]]));
}

/** Which day to select when opening a month. */
export function defaultSelectedDay(month: string, today: string, requested?: string) {
  if (requested && isIsoDate(requested) && monthOf(requested) === month) return requested;
  if (monthOf(today) === month) return today;
  return `${month}-01`;
}
