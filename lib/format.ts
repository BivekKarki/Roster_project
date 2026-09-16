import { dayName, isIsoDate } from "./dates";

const moneyFormatter = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export const money = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : moneyFormatter.format(n);

export const signedMoney = (n: number) => `${n > 0 ? "+" : ""}${money(n)}`;

/** "YYYY-MM-DD" -> "DD/MM/YYYY" */
export function fmtDate(s: string | null | undefined, fallback = "—") {
  if (!s || !isIsoDate(s)) return fallback;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

/** "HH:MM" (24h) -> "7:00 AM" */
export function fmtTime(t: string | null | undefined) {
  if (!t) return "—";
  const [hRaw, m] = t.split(":").map(Number);
  const suffix = hRaw >= 12 ? "PM" : "AM";
  const h = hRaw % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const fmtHours = (n: number) => `${round2(n || 0)} h`;

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;

/** "YYYY-MM-DD" -> "Tue 22/09/2026" */
export const fmtDayDate = (s: string | null | undefined, fallback = "—") =>
  s && isIsoDate(s) ? `${dayName(s).slice(0, 3)} ${fmtDate(s)}` : fallback;

/** "7 days late", "on time", "2 days early" */
export function lateness(days: number | null) {
  if (days === null) return "";
  if (days === 0) return "on time";
  return days > 0 ? `${plural(days, "day")} late` : `${plural(-days, "day")} early`;
}
