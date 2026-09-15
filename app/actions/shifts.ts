"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calcHours, enrichShift, splitPayment } from "@/lib/calc";
import { addDays, isoToDb, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import { toShiftDTO } from "@/lib/mappers";
import { requireUserId } from "@/lib/session";
import type { ActionState } from "@/lib/types";
import { firstError, formToObject, payBatchSchema, shiftSchema } from "@/lib/validation";

const safeReturn = (value: FormDataEntryValue | null, fallback = "/roster") => {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
};

export async function saveShift(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = shiftSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (calcHours(d.startTime, d.endTime, d.breakMins) <= 0) return { error: "The break is longer than the shift." };

  // Link to the saved employer/location (by id, or by name if the id wasn't sent).
  const site = await prisma.site.findFirst({
    where: d.siteId ? { id: d.siteId, userId } : { userId, employer: d.employer, location: d.location },
    select: { id: true },
  });

  // Every shift stores its own snapshot of names, times, rate and overtime rule.
  const data = {
    siteId: site?.id ?? null,
    employer: d.employer,
    location: d.location,
    date: isoToDb(d.date),
    startTime: d.startTime,
    endTime: d.endTime,
    breakMins: d.breakMins,
    rate: d.rate,
    otThreshold: d.otEnabled ? (d.otThreshold ?? 8) : null,
    otMultiplier: d.otEnabled ? (d.otMultiplier ?? 1.5) : null,
    status: d.status,
    notes: d.notes,
    expectedPayDate: d.expectedPayDate ? isoToDb(d.expectedPayDate) : null,
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
    for (let week = 1; week <= d.repeatWeeks; week++) {
      rows.push({
        ...data,
        userId,
        date: isoToDb(addDays(d.date, 7 * week)),
        expectedPayDate: d.expectedPayDate ? isoToDb(addDays(d.expectedPayDate, 7 * week)) : null,
        status: d.status === "COMPLETED" || d.status === "CANCELLED" ? "SCHEDULED" : d.status,
        paid: false,
        actualPayDate: null,
        actualAmount: null,
        payNotes: "",
      });
    }
    await prisma.shift.createMany({ data: rows });
  }

  revalidatePath("/", "layout");
  redirect(safeReturn(formData.get("returnTo")));
}

export async function deleteShift(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await prisma.shift.deleteMany({ where: { id, userId } });
  revalidatePath("/", "layout");
  redirect(safeReturn(formData.get("returnTo")));
}

export async function markCompleted(formData: FormData) {
  const userId = await requireUserId();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return;
  await prisma.shift.updateMany({
    where: { id: { in: ids }, userId, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    data: { status: "COMPLETED" },
  });
  revalidatePath("/", "layout");
}

export async function markPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
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

  revalidatePath("/", "layout");
  return { ok: true, message: `${plural(rows.length, "shift")} marked paid` };
}

export async function markUnpaid(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await prisma.shift.updateMany({
    where: { id, userId },
    data: { paid: false, actualPayDate: null, actualAmount: null },
  });
  revalidatePath("/", "layout");
}
