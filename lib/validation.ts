import { z } from "zod";
import { isIsoDate } from "./dates";

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time");
export const isoSchema = z.string().refine(isIsoDate, "Enter a valid date");
const optionalIso = z.string().optional().transform((v) => (v ?? "").trim()).refine((v) => v === "" || isIsoDate(v), "Enter a valid date")
  .transform((v) => (v === "" ? null : v));
const optionalTime = z.string().optional().transform((v) => (v ?? "").trim()).refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Enter a valid time")
  .transform((v) => (v === "" ? null : v));
const optionalMoney = z.string().optional().transform((v) => (v ?? "").trim()).refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1_000_000), "Enter a valid amount")
  .transform((v) => (v === "" ? null : Math.round(Number(v) * 100) / 100));
const text = (max: number) => z.string().trim().max(max);
const checkbox = z.string().optional().transform((v) => v === "on" || v === "true");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password").max(200),
});

export const signupSchema = z.object({
  name: text(80).optional().default(""),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  sample: checkbox,
});

export const shiftSchema = z.object({
  id: z.string().optional().default(""),
  siteId: z.string().optional().default(""),
  employer: text(80).min(1, "Choose an employer"),
  location: text(80).min(1, "Choose a location"),
  date: isoSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  breakMins: z.coerce.number().int().min(0).max(600),
  rate: optionalMoney,
  otEnabled: checkbox,
  otThreshold: optionalMoney,
  otMultiplier: optionalMoney,
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"]),
  autoStatus: checkbox,
  notes: text(500).optional().default(""),
  payPeriodStart: optionalIso,
  payPeriodEnd: optionalIso,
  officialPayDate: optionalIso,
  expectedPayDate: optionalIso,
  paid: checkbox,
  actualPayDate: optionalIso,
  actualAmount: optionalMoney,
  payNotes: text(500).optional().default(""),
  repeatWeeks: z.coerce.number().int().min(0).max(26).optional().default(0),
});

export const siteSchema = z.object({
  id: z.string().optional().default(""),
  employer: text(80).min(1, "Enter the employer name"),
  location: text(80).min(1, "Enter the location"),
  defaultStart: optionalTime,
  defaultEnd: optionalTime,
  defaultRate: optionalMoney,
  payFrequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "IRREGULAR"]),
  payDelayDays: z.coerce.number().int().min(0).max(120),
  payPeriodStart: optionalIso,
  payPeriodDays: z.coerce.number().int().refine((n) => n === 7 || n === 14, "Choose weekly or fortnightly"),
  payWeekday: z.string().optional().transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || /^[0-6]$/.test(v), "Choose a pay day")
    .transform((v) => (v === "" ? null : Number(v))),
  payLateDays: z.coerce.number().int().min(0).max(60),
  notes: text(500).optional().default(""),
  renameExisting: checkbox,
  fillBlankRates: checkbox,
  recalcUnpaid: checkbox,
});

export const settingsSchema = z.object({
  payDelayDays: z.coerce.number().int().min(0).max(120),
  dueSoonDays: z.coerce.number().int().min(0).max(60),
  fortnightStart: isoSchema,
  overtimeEnabled: checkbox,
  overtimeThreshold: z.coerce.number().min(0).max(24),
  overtimeMultiplier: z.coerce.number().min(1).max(5),
  autoCompleteShifts: checkbox,
});

export const verifyCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  code: z.string().trim().min(1, "Enter the 6-digit code").max(20),
});

export const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const profileSchema = z.object({
  name: text(80),
});

export const autoLogoutSchema = z.object({
  idleTimeoutMinutes: z.coerce.number().int().refine((n) => [15, 30, 60, 240, 1440, 0].includes(n), "Choose an option"),
});

export const payCycleSchema = z.object({
  payPeriodStart: isoSchema,
  payPeriodDays: z.coerce.number().int().refine((n) => n === 7 || n === 14, "Choose weekly or fortnightly"),
  payWeekday: z.coerce.number().int().min(0, "Choose a pay day").max(6, "Choose a pay day"),
  payLateDays: z.coerce.number().int().min(0).max(60),
  recalcUnpaid: checkbox,
  alignDashboard: checkbox,
});

export const payBatchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one shift").max(500),
  payDate: isoSchema,
  amount: optionalMoney,
  notes: text(500).optional().default(""),
});

/** Convert FormData into a plain object; repeated keys become the last value. */
export const formToObject = (fd: FormData) => {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
};

export const firstError = (error: z.ZodError) => error.issues[0]?.message ?? "Please check the form";
