import type { Settings, Shift, Site } from "@/lib/generated/prisma/client";
import { dbToIso } from "./dates";
import type { SettingsDTO, ShiftDTO, SiteDTO } from "./types";

type DecimalLike = { toString(): string } | null;
const dec = (v: DecimalLike) => (v === null ? null : Number(v.toString()));

export const toShiftDTO = (s: Shift): ShiftDTO => ({
  id: s.id,
  siteId: s.siteId,
  employer: s.employer,
  location: s.location,
  date: dbToIso(s.date),
  startTime: s.startTime,
  endTime: s.endTime,
  breakMins: s.breakMins,
  rate: dec(s.rate),
  otThreshold: dec(s.otThreshold),
  otMultiplier: dec(s.otMultiplier),
  status: s.status,
  notes: s.notes,
  payPeriodStart: s.payPeriodStart ? dbToIso(s.payPeriodStart) : null,
  payPeriodEnd: s.payPeriodEnd ? dbToIso(s.payPeriodEnd) : null,
  officialPayDate: s.officialPayDate ? dbToIso(s.officialPayDate) : null,
  expectedPayDate: s.expectedPayDate ? dbToIso(s.expectedPayDate) : null,
  paid: s.paid,
  actualPayDate: s.actualPayDate ? dbToIso(s.actualPayDate) : null,
  actualAmount: dec(s.actualAmount),
  payNotes: s.payNotes,
});

export const toSiteDTO = (s: Site): SiteDTO => ({
  id: s.id,
  employer: s.employer,
  location: s.location,
  defaultStart: s.defaultStart,
  defaultEnd: s.defaultEnd,
  defaultRate: dec(s.defaultRate),
  payFrequency: s.payFrequency,
  payDelayDays: s.payDelayDays,
  payPeriodStart: s.payPeriodStart ? dbToIso(s.payPeriodStart) : null,
  payPeriodDays: s.payPeriodDays,
  payWeekday: s.payWeekday,
  payLateDays: s.payLateDays,
  notes: s.notes,
});

export const toSettingsDTO = (s: Settings): SettingsDTO => ({
  payDelayDays: s.payDelayDays,
  dueSoonDays: s.dueSoonDays,
  fortnightStart: dbToIso(s.fortnightStart),
  overtimeEnabled: s.overtimeEnabled,
  overtimeThreshold: dec(s.overtimeThreshold) ?? 8,
  overtimeMultiplier: dec(s.overtimeMultiplier) ?? 1.5,
});
