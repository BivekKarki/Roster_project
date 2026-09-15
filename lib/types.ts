export type Status = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
export type Frequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "IRREGULAR";
export type PayState = "paid" | "soon" | "overdue" | "waiting";
export type PeriodKind = "week" | "fortnight" | "month" | "fy";

export const STATUSES: Status[] = ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"];
export const FREQUENCIES: Frequency[] = ["WEEKLY", "FORTNIGHTLY", "MONTHLY", "IRREGULAR"];

export const STATUS_LABEL: Record<Status, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY: "Monthly",
  IRREGULAR: "Irregular",
};

/** Plain, serialisable shift (safe to pass to client components). Dates are "YYYY-MM-DD". */
export type ShiftDTO = {
  id: string;
  siteId: string | null;
  employer: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMins: number;
  rate: number | null;
  otThreshold: number | null;
  otMultiplier: number | null;
  status: Status;
  notes: string;
  expectedPayDate: string | null;
  paid: boolean;
  actualPayDate: string | null;
  actualAmount: number | null;
  payNotes: string;
};

export type EnrichedShift = ShiftDTO & {
  day: string;
  hours: number;
  pay: number | null;
  paidAmount: number;
  difference: number | null;
  payState: PayState | null;
  daysOverdue: number;
  daysUntilDue: number | null;
};

export type SiteDTO = {
  id: string;
  employer: string;
  location: string;
  defaultStart: string | null;
  defaultEnd: string | null;
  defaultRate: number | null;
  payFrequency: Frequency;
  payDelayDays: number;
  notes: string;
};

export type SettingsDTO = {
  payDelayDays: number;
  dueSoonDays: number;
  fortnightStart: string;
  overtimeEnabled: boolean;
  overtimeThreshold: number;
  overtimeMultiplier: number;
};

export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;
