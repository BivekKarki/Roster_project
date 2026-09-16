/**
 * Date helpers. All calendar dates are "YYYY-MM-DD" strings and all arithmetic is
 * done in UTC so results never shift with the server's or phone's time zone.
 */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

const MS_PER_DAY = 86_400_000;

export const isIsoDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const toUtc = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const addDays = (s: string, n: number) =>
  new Date(toUtc(s) + (Number(n) || 0) * MS_PER_DAY).toISOString().slice(0, 10);

/** a minus b, in whole days */
export const diffDays = (a: string, b: string) => Math.round((toUtc(a) - toUtc(b)) / MS_PER_DAY);

export const dayName = (s: string) => (isIsoDate(s) ? DAY_NAMES[new Date(toUtc(s)).getUTCDay()] : "");

export const weekdayOf = (s: string) => new Date(toUtc(s)).getUTCDay();

export const mondayOf = (s: string) => addDays(s, -((new Date(toUtc(s)).getUTCDay() + 6) % 7));

/** Today's date in the app's time zone (defaults to Australia/Sydney). */
export function todayIso(timeZone = process.env.APP_TIMEZONE || "Australia/Sydney") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** "YYYY-MM-DD" -> Date for a Postgres DATE column */
export const isoToDb = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Date from a Postgres DATE column -> "YYYY-MM-DD" */
export const dbToIso = (d: Date) => d.toISOString().slice(0, 10);
