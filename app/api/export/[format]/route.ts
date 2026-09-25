import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { summarizeByEmployer } from "@/lib/calc";
import { syncShiftStatuses } from "@/lib/shiftStatusSync";
import { findShifts, getSettings, getSites } from "@/lib/data";
import { todayIso } from "@/lib/dates";
import { fmtDate, fmtTime } from "@/lib/format";
import { shiftExportRows, toCsv } from "@/lib/export";
import { filtersToWhere, readFilters } from "@/lib/filters";
import { FREQUENCY_LABEL, WEEKDAYS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ format: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await syncShiftStatuses(userId);

  const { format } = await params;
  const stamp = todayIso();
  const settings = await getSettings(userId);
  const filters = readFilters(Object.fromEntries(request.nextUrl.searchParams));
  let shifts = await findShifts(userId, filtersToWhere(filters), settings);
  if (filters.payment === "overdue") shifts = shifts.filter((s) => s.payState === "overdue");

  if (format === "csv") {
    const body = "\ufeff" + toCsv(shiftExportRows(shifts));
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="shifts-${stamp}.csv"`,
      },
    });
  }

  // Timesheet: Date, Day, Employer, Location, Start, End, Total hours, with a total row,
  // plus a second sheet totalling hours for each employer and location separately.
  if (format === "timesheet") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "ShiftBook";
    const worked = shifts.filter((s) => s.status !== "CANCELLED").sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    const ws = wb.addWorksheet("Timesheet", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: "Date", key: "date", width: 13 },
      { header: "Day", key: "day", width: 12 },
      { header: "Employer", key: "employer", width: 16 },
      { header: "Location", key: "location", width: 16 },
      { header: "Start", key: "start", width: 11 },
      { header: "End", key: "end", width: 11 },
      { header: "Total hours", key: "hours", width: 13 },
    ];
    worked.forEach((s) => ws.addRow({
      date: fmtDate(s.date, ""), day: s.day, employer: s.employer, location: s.location,
      start: fmtTime(s.startTime), end: fmtTime(s.endTime), hours: s.hours,
    }));
    const lastRow = ws.rowCount;
    const totalRow = ws.addRow({ end: "TOTAL", hours: worked.length ? { formula: `SUM(G2:G${lastRow})` } : 0 });
    ws.getRow(1).font = { bold: true };
    totalRow.font = { bold: true };
    totalRow.border = { top: { style: "thin" } };
    ws.getColumn("hours").numFmt = "0.00";
    ws.getColumn("hours").alignment = { horizontal: "right" };

    const sites = await getSites(userId);
    const separate = new Set(sites.filter((s) => s.separateTotals).map((s) => `${s.employer}|${s.location}`));

    // Summary: places you marked as separate get their own line (different pay rate),
    // everything else is added together.
    const summaryRows: { label: string; shifts: number; hours: number }[] = [];
    const rest = { label: "All other work", shifts: 0, hours: 0 };
    for (const s of worked) {
      const key = `${s.employer}|${s.location}`;
      if (separate.has(key)) {
        const existing = summaryRows.find((r) => r.label === `${s.employer}, ${s.location}`);
        const row = existing ?? { label: `${s.employer}, ${s.location}`, shifts: 0, hours: 0 };
        row.shifts += 1;
        row.hours = Math.round((row.hours + s.hours) * 100) / 100;
        if (!existing) summaryRows.push(row);
      } else {
        rest.shifts += 1;
        rest.hours = Math.round((rest.hours + s.hours) * 100) / 100;
      }
    }
    if (rest.shifts > 0 || summaryRows.length === 0) summaryRows.push(rest);

    const wsSummary = wb.addWorksheet("Hours summary", { views: [{ state: "frozen", ySplit: 1 }] });
    wsSummary.columns = [
      { header: "Work", key: "label", width: 30 },
      { header: "Shifts", key: "shifts", width: 9 },
      { header: "Total hours", key: "hours", width: 13 },
    ];
    summaryRows.forEach((r) => wsSummary.addRow(r));
    const lastSummary = wsSummary.rowCount;
    const summaryTotal = wsSummary.addRow({
      label: "TOTAL",
      shifts: { formula: `SUM(B2:B${lastSummary})` },
      hours: { formula: `SUM(C2:C${lastSummary})` },
    });
    wsSummary.getRow(1).font = { bold: true };
    summaryTotal.font = { bold: true };
    summaryTotal.border = { top: { style: "thin" } };
    wsSummary.getColumn("hours").numFmt = "0.00";

    // Full breakdown: every employer + location, so nothing is hidden.
    const places = new Map<string, { employer: string; location: string; shifts: number; hours: number }>();
    for (const s of worked) {
      const key = `${s.employer}|${s.location}`;
      const row = places.get(key) ?? { employer: s.employer, location: s.location, shifts: 0, hours: 0 };
      row.shifts += 1;
      row.hours = Math.round((row.hours + s.hours) * 100) / 100;
      places.set(key, row);
    }
    const ws2 = wb.addWorksheet("Hours by place", { views: [{ state: "frozen", ySplit: 1 }] });
    ws2.columns = [
      { header: "Location", key: "location", width: 16 },
      { header: "Employer", key: "employer", width: 16 },
      { header: "Shifts", key: "shifts", width: 9 },
      { header: "Total hours", key: "hours", width: 13 },
    ];
    [...places.values()]
      .sort((a, b) => b.hours - a.hours || a.employer.localeCompare(b.employer))
      .forEach((p) => ws2.addRow(p));
    const lastRow2 = ws2.rowCount;
    const totalRow2 = ws2.addRow({
      employer: "TOTAL",
      shifts: places.size ? { formula: `SUM(C2:C${lastRow2})` } : 0,
      hours: places.size ? { formula: `SUM(D2:D${lastRow2})` } : 0,
    });
    ws2.getRow(1).font = { bold: true };
    totalRow2.font = { bold: true };
    totalRow2.border = { top: { style: "thin" } };
    ws2.getColumn("hours").numFmt = "0.00";

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="timesheet-${stamp}.xlsx"`,
      },
    });
  }

  if (format === "xlsx") {
    const sites = await getSites(userId);
    const wb = new ExcelJS.Workbook();
    wb.creator = "ShiftBook";
    const addSheet = (name: string, rows: Record<string, unknown>[]) => {
      const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
      const headers = rows.length ? Object.keys(rows[0]) : ["No data"];
      ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(12, h.length + 2) }));
      rows.forEach((r) => ws.addRow(r));
      ws.getRow(1).font = { bold: true };
    };
    addSheet("Shifts", shiftExportRows(shifts));
    addSheet("Totals by employer", summarizeByEmployer(shifts).map((e) => ({
      Employer: e.name, Shifts: e.shifts, Hours: e.hours, "Expected (AUD)": e.expected,
      "Paid (AUD)": e.paid, "Outstanding (AUD)": e.unpaidAmount,
    })));
    addSheet("Employers", sites.map((s) => ({
      Employer: s.employer, Location: s.location,
      "Default start": s.defaultStart ? fmtTime(s.defaultStart) : "", "Default end": s.defaultEnd ? fmtTime(s.defaultEnd) : "",
      "Default rate (AUD)": s.defaultRate ?? "", "Payment frequency": FREQUENCY_LABEL[s.payFrequency],
      "Pay period start": s.payPeriodStart ? fmtDate(s.payPeriodStart) : "",
      "Pay period (days)": s.payPeriodDays,
      "Supposed pay day": s.payWeekday === null ? "" : WEEKDAYS[s.payWeekday],
      "Payroll late by (days)": s.payLateDays,
      "Paid after (days, if no pay cycle)": s.payDelayDays, Notes: s.notes,
    })));
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="shiftbook-${stamp}.xlsx"`,
      },
    });
  }

  if (format === "json") {
    const sites = await getSites(userId);
    const all = await findShifts(userId, {}, settings);
    const backup = {
      app: "shiftbook",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      sites: sites.map(({ id: _id, ...s }) => s),
      shifts: all.map((s) => ({
        employer: s.employer, location: s.location, date: s.date, startTime: s.startTime, endTime: s.endTime,
        breakMins: s.breakMins, rate: s.rate, otThreshold: s.otThreshold, otMultiplier: s.otMultiplier,
        status: s.status, autoStatus: s.autoStatus, notes: s.notes, payPeriodStart: s.payPeriodStart, payPeriodEnd: s.payPeriodEnd,
        officialPayDate: s.officialPayDate, expectedPayDate: s.expectedPayDate, paid: s.paid,
        actualPayDate: s.actualPayDate, actualAmount: s.actualAmount, payNotes: s.payNotes,
      })),
    };
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="shiftbook-backup-${stamp}.json"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown format" }, { status: 404 });
}
