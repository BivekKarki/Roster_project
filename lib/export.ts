import { fmtDate, fmtTime } from "./format";
import { STATUS_LABEL, type EnrichedShift } from "./types";

export function shiftExportRows(list: EnrichedShift[]) {
  return list.map((s) => ({
    Date: fmtDate(s.date, ""),
    Day: s.day,
    Employer: s.employer,
    Location: s.location,
    Start: fmtTime(s.startTime),
    End: fmtTime(s.endTime),
    "Break (mins)": s.breakMins,
    "Total hours": s.hours,
    "Hourly rate (AUD)": s.rate ?? "",
    "Expected pay (AUD)": s.pay ?? "",
    Status: STATUS_LABEL[s.status],
    Notes: s.notes,
    "Pay period start": fmtDate(s.payPeriodStart, ""),
    "Pay period end": fmtDate(s.payPeriodEnd, ""),
    "Official payment date": fmtDate(s.officialPayDate, ""),
    "Expected payment date": fmtDate(s.expectedPayDate, ""),
    "Expected days after official": s.expectedLateDays ?? "",
    Paid: s.status === "COMPLETED" ? (s.paid ? "Yes" : "No") : "",
    "Actual payment date": fmtDate(s.actualPayDate, ""),
    "Paid days after official": s.paidDaysAfterOfficial ?? "",
    "Actual amount (AUD)": s.paid ? (s.actualAmount ?? "") : "",
    "Difference (AUD)": s.difference ?? "",
    "Payment notes": s.payNotes,
    "Overtime rule": s.otThreshold !== null ? `After ${s.otThreshold} h at x${s.otMultiplier ?? 1}` : "",
  }));
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const t = String(v ?? "");
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
}
