import type { Prisma } from "@/lib/generated/prisma/client";
import { dateRange } from "./data";
import { isIsoDate } from "./dates";
import { STATUSES, type Status } from "./types";

export type ShiftFilters = {
  q: string; employer: string; location: string; status: string; payment: string; from: string; to: string;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function readFilters(params: Params): ShiftFilters {
  return {
    q: one(params.q).slice(0, 80),
    employer: one(params.employer),
    location: one(params.location),
    status: one(params.status),
    payment: one(params.payment),
    from: isIsoDate(one(params.from)) ? one(params.from) : "",
    to: isIsoDate(one(params.to)) ? one(params.to) : "",
  };
}

/** Database-side filters. "Overdue" and "No rate" are refined after calculation. */
export function filtersToWhere(f: ShiftFilters): Prisma.ShiftWhereInput {
  const where: Prisma.ShiftWhereInput = {};
  if (f.q) {
    where.OR = [
      { employer: { contains: f.q, mode: "insensitive" } },
      { location: { contains: f.q, mode: "insensitive" } },
      { notes: { contains: f.q, mode: "insensitive" } },
      { payNotes: { contains: f.q, mode: "insensitive" } },
    ];
  }
  if (f.employer) where.employer = f.employer;
  if (f.location) where.location = f.location;
  if (STATUSES.includes(f.status as Status)) where.status = f.status as Status;
  if (f.payment === "unpaid" || f.payment === "overdue") { where.status = "COMPLETED"; where.paid = false; }
  if (f.payment === "paid") where.paid = true;
  if (f.payment === "norate") where.rate = null;
  const range = dateRange(f.from, f.to);
  if (range) where.date = range;
  return where;
}

export const filtersToQuery = (f: ShiftFilters) =>
  new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
