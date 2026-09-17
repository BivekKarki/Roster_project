import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { summarizeByEmployer } from "@/lib/calc";
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
        status: s.status, notes: s.notes, payPeriodStart: s.payPeriodStart, payPeriodEnd: s.payPeriodEnd,
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
