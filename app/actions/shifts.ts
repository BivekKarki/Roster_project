"use server";

import { revalidatePath } from "next/cache";
import { bumpUser } from "@/lib/cache";
import { redirect } from "next/navigation";
import { calcHours, enrichShift, hasPayCycle, payDatesFor, splitPayment } from "@/lib/calc";
import { getSettings } from "@/lib/data";
import { addDays, diffDays, isoToDb, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import { toShiftDTO, toSiteDTO } from "@/lib/mappers";
import { appTimeZone, automaticStatus, shiftPhase, shiftWindow } from "@/lib/shift-time";
import { requireUserIdForWrite } from "@/lib/session";
import type { ActionState } from "@/lib/types";
import { firstError, formToObject, payBatchSchema, shiftSchema } from "@/lib/validation";

const safeReturn = (value: FormDataEntryValue | null, fallback = "/roster") => {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
};

const dbDate = (iso: string | null) => (iso ? isoToDb(iso) : null);

export async function saveShift(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserIdForWrite();
  const parsed = shiftSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (calcHours(d.startTime, d.endTime, d.breakMins) <= 0) return { error: "The break is longer than the shift." };

  // Link to the saved employer/location (by id, or by name if the id wasn't sent).
  const [siteRow, settings] = await Promise.all([
    prisma.site.findFirst({
      where: d.siteId ? { id: d.siteId, userId } : { userId, employer: d.employer, location: d.location },
    }),
    getSettings(userId),
  ]);
  const cycle = siteRow ? toSiteDTO(siteRow) : null;

  // Pay dates: use what the form calculated (the expected date may have been edited).
  // If the form didn't send an official date but the employer has a pay cycle, calculate it here.
  const auto = payDatesFor(d.date, cycle, settings.payDelayDays);
  const useAuto = hasPayCycle(cycle) && !d.officialPayDate;
  const pay = useAuto
    ? auto
    : {
        periodStart: d.payPeriodStart,
        periodEnd: d.payPeriodEnd,
        officialPayDate: d.officialPayDate,
        expectedPayDate: d.expectedPayDate ?? auto.expectedPayDate,
      };

  // Automatic status: a Scheduled/Confirmed shift whose end time has already passed is saved as Completed,
  // unless you picked the status yourself (autoStatus off) or turned the feature off in Settings.
  const timeZone = appTimeZone();
  const now = Date.now();
  const statusFor = (date: string, requested: typeof d.status) =>
    settings.autoCompleteShifts && d.autoStatus
      ? automaticStatus(requested, shiftPhase(now, shiftWindow(date, d.startTime, d.endTime, timeZone)))
      : requested;

  // Every shift stores its own snapshot of names, times, rate, overtime rule and pay dates.
  const data = {
    siteId: siteRow?.id ?? null,
    employer: d.employer,
    location: d.location,
    date: isoToDb(d.date),
    startTime: d.startTime,
    endTime: d.endTime,
    breakMins: d.breakMins,
    rate: d.rate,
    otThreshold: d.otEnabled ? (d.otThreshold ?? 8) : null,
    otMultiplier: d.otEnabled ? (d.otMultiplier ?? 1.5) : null,
    status: statusFor(d.date, d.status),
    autoStatus: d.autoStatus,
    notes: d.notes,
    payPeriodStart: dbDate(pay.periodStart),
    payPeriodEnd: dbDate(pay.periodEnd),
    officialPayDate: dbDate(pay.officialPayDate),
    expectedPayDate: dbDate(pay.expectedPayDate),
    paid: d.paid,
    actualPayDate: d.paid ? isoToDb(d.actualPayDate ?? todayIso()) : null,
    actualAmount: d.paid ? d.actualAmount : null,
    payNotes: d.payNotes,
  };

  if (d.id) {
    const result = await prisma.shift.updateMany({ where: { id: d.id, userId }, data });
    if (result.count === 0) return { error: "That shift no longer exists." };
  } else {
    const rows = [{ ...data, userId }];
    // Keep any manual change to the expected date (e.g. +3 days) on the repeated shifts too.
    const manualShift = pay.expectedPayDate ? diffDays(pay.expectedPayDate, auto.expectedPayDate) : 0;
    for (let week = 1; week <= d.repeatWeeks; week++) {
      const date = addDays(d.date, 7 * week);
      const next = hasPayCycle(cycle)
        ? payDatesFor(date, cycle, settings.payDelayDays)
        : { periodStart: null, periodEnd: null, officialPayDate: null, expectedPayDate: addDays(auto.expectedPayDate, 7 * week) };
      rows.push({
        ...data,
        userId,
        date: isoToDb(date),
        payPeriodStart: dbDate(next.periodStart),
        payPeriodEnd: dbDate(next.periodEnd),
        officialPayDate: dbDate(next.officialPayDate),
        expectedPayDate: isoToDb(addDays(next.expectedPayDate, manualShift)),
        status: statusFor(date, d.status === "COMPLETED" || d.status === "CANCELLED" ? "SCHEDULED" : d.status),
        paid: false,
        actualPayDate: null,
        actualAmount: null,
        payNotes: "",
      });
    }
    await prisma.shift.createMany({ data: rows });
  }

  bumpUser(userId);
  revalidatePath("/", "layout");
  redirect(safeReturn(formData.get("returnTo")));
}

export async function deleteShift(formData: FormData) {
  const userId = await requireUserIdForWrite();
  const id = String(formData.get("id") ?? "");
  await prisma.shift.deleteMany({ where: { id, userId } });
  bumpUser(userId);
  revalidatePath("/", "layout");
  redirect(safeReturn(formData.get("returnTo")));
}

export async function markCompleted(formData: FormData) {
  const userId = await requireUserIdForWrite();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return;
  await prisma.shift.updateMany({
    where: { id: { in: ids }, userId, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    data: { status: "COMPLETED" },
  });
  bumpUser(userId);
  revalidatePath("/", "layout");
}

export async function markPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserIdForWrite();
  const obj = { ...formToObject(formData), ids: formData.getAll("ids").map(String) };
  const parsed = payBatchSchema.safeParse(obj);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { ids, payDate, amount, notes } = parsed.data;

  const rows = await prisma.shift.findMany({
    where: { id: { in: ids }, userId, status: "COMPLETED", paid: false },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  if (rows.length === 0) return { error: "Those shifts are already paid or not completed." };

  const today = todayIso();
  const expected = rows.map((r) => enrichShift(toShiftDTO(r), today, 0).pay);
  let amounts: (number | null)[] = expected;
  if (amount !== null) {
    if (rows.length === 1) amounts = [amount];
    else if (expected.every((e) => e !== null && e > 0)) amounts = splitPayment(amount, expected as number[]);
  }

  // All shifts are marked paid together, or none are.
  await prisma.$transaction(
    rows.map((r, i) =>
      prisma.shift.update({
        where: { id: r.id },
        data: {
          paid: true,
          actualPayDate: isoToDb(payDate),
          actualAmount: amounts[i],
          payNotes: notes || r.payNotes,
        },
      }),
    ),
  );

  bumpUser(userId);
  revalidatePath("/", "layout");
  return { ok: true, message: `${plural(rows.length, "shift")} marked paid` };
}

export async function markUnpaid(formData: FormData) {
  const userId = await requireUserIdForWrite();
  const id = String(formData.get("id") ?? "");
  await prisma.shift.updateMany({
    where: { id, userId },
    data: { paid: false, actualPayDate: null, actualAmount: null },
  });
  bumpUser(userId);
  revalidatePath("/", "layout");
}
