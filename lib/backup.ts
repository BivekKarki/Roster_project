/**
 * Backup import/export. Accepts this app's backups AND backups copied from the
 * earlier Claude artifact version (different field names and status casing).
 */
import { isIsoDate } from "./dates";
import type { Frequency, Status } from "./types";
import { FREQUENCIES, STATUSES } from "./types";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
type Obj = Record<string, unknown>;

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const money = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null;
};
const date = (v: unknown) => (isIsoDate(v) ? v : null);
const time = (v: unknown) => (typeof v === "string" && TIME.test(v) ? v : null);
const int = (v: unknown, fallback: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : fallback;
};
const status = (v: unknown): Status => {
  const up = str(v).toUpperCase() as Status;
  return STATUSES.includes(up) ? up : "SCHEDULED";
};
const frequency = (v: unknown): Frequency => {
  const up = str(v).toUpperCase() as Frequency;
  return FREQUENCIES.includes(up) ? up : "FORTNIGHTLY";
};

export type ImportSite = {
  employer: string; location: string; defaultStart: string | null; defaultEnd: string | null;
  defaultRate: number | null; payFrequency: Frequency; payDelayDays: number; notes: string;
};
export type ImportShift = {
  employer: string; location: string; date: string; startTime: string; endTime: string; breakMins: number;
  rate: number | null; otThreshold: number | null; otMultiplier: number | null; status: Status; notes: string;
  expectedPayDate: string | null; paid: boolean; actualPayDate: string | null; actualAmount: number | null; payNotes: string;
};
export type ImportSettings = {
  payDelayDays: number; dueSoonDays: number; fortnightStart: string | null;
  overtimeEnabled: boolean; overtimeThreshold: number; overtimeMultiplier: number;
};

export function parseBackup(raw: string) {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't valid backup JSON.");
  }
  if (!data || typeof data !== "object") throw new Error("That file isn't a backup.");
  const root = data as Obj;
  if (!Array.isArray(root.shifts) || !Array.isArray(root.sites)) throw new Error("The backup must contain sites and shifts.");

  const sites: ImportSite[] = [];
  const seen = new Set<string>();
  for (const item of root.sites as Obj[]) {
    const employer = str(item?.employer, 80);
    const location = str(item?.location, 80);
    const key = `${employer.toLowerCase()}|${location.toLowerCase()}`;
    if (!employer || !location || seen.has(key)) continue;
    seen.add(key);
    sites.push({
      employer, location,
      defaultStart: time(item.defaultStart), defaultEnd: time(item.defaultEnd),
      defaultRate: money(item.defaultRate), payFrequency: frequency(item.payFrequency),
      payDelayDays: int(item.payDelayDays, 14, 120), notes: str(item.notes),
    });
  }

  const shifts: ImportShift[] = [];
  let skipped = 0;
  for (const item of root.shifts as Obj[]) {
    const employer = str(item?.employer, 80);
    const location = str(item?.location, 80);
    const d = date(item?.date);
    const startTime = time(item?.startTime ?? item?.start);
    const endTime = time(item?.endTime ?? item?.end);
    if (!employer || !location || !d || !startTime || !endTime) { skipped++; continue; }
    const ot = (item.ot && typeof item.ot === "object" ? item.ot : null) as Obj | null;
    const paid = item.paid === true;
    shifts.push({
      employer, location, date: d, startTime, endTime,
      breakMins: int(item.breakMins, 0, 600),
      rate: money(item.rate),
      otThreshold: money(item.otThreshold ?? ot?.threshold),
      otMultiplier: money(item.otMultiplier ?? ot?.multiplier),
      status: status(item.status),
      notes: str(item.notes),
      expectedPayDate: date(item.expectedPayDate),
      paid,
      actualPayDate: paid ? date(item.actualPayDate) : null,
      actualAmount: paid ? money(item.actualAmount) : null,
      payNotes: str(item.payNotes),
    });
  }

  let settings: ImportSettings | null = null;
  if (root.settings && typeof root.settings === "object") {
    const s = root.settings as Obj;
    const ot = (s.overtime && typeof s.overtime === "object" ? s.overtime : {}) as Obj;
    settings = {
      payDelayDays: int(s.payDelayDays, 14, 120),
      dueSoonDays: int(s.dueSoonDays, 3, 60),
      fortnightStart: date(s.fortnightStart),
      overtimeEnabled: (s.overtimeEnabled ?? ot.enabled) === true,
      overtimeThreshold: money(s.overtimeThreshold ?? ot.threshold) ?? 8,
      overtimeMultiplier: Math.max(1, money(s.overtimeMultiplier ?? ot.multiplier) ?? 1.5),
    };
  }

  return { sites, shifts, settings, skipped };
}
