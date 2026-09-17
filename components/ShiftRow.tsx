import Link from "next/link";
import { PAY_STATE_META } from "@/lib/calc";
import { fmtDate, fmtDayDate, fmtHours, fmtTime, money } from "@/lib/format";
import type { EnrichedShift } from "@/lib/types";
import { StatusPill } from "./ui";

export function ShiftRow({ s, showDate = false, returnTo }: { s: EnrichedShift; showDate?: boolean; returnTo?: string }) {
  const cancelled = s.status === "CANCELLED";
  const href = `/shifts/${s.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  return (
    <Link href={href} className={`block rounded-xl border border-slate-200 bg-white px-3 py-3 active:bg-slate-50 ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {showDate && <div className="text-xs text-slate-500">{s.day} {fmtDate(s.date)}</div>}
          <div className={`num font-semibold ${cancelled ? "line-through" : ""}`}>{fmtTime(s.startTime)}–{fmtTime(s.endTime)}</div>
          <div className="truncate text-slate-700">{s.employer}, {s.location}</div>
        </div>
        <div className="num shrink-0 text-right">
          <div className="font-semibold">{fmtHours(s.hours)}</div>
          <div className="text-sm">{s.pay === null ? <span className="font-semibold text-orange-600">Add rate</span> : money(s.pay)}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusPill status={s.status} />
        {s.payState && <span className="text-xs text-slate-700">{PAY_STATE_META[s.payState].icon} {PAY_STATE_META[s.payState].label}</span>}
        {s.notes && <span className="truncate text-xs text-slate-500">📝 {s.notes}</span>}
      </div>
      {s.status === "COMPLETED" && !s.paid && s.expectedPayDate && (
        <div className="num mt-1 text-xs text-slate-600">
          {s.officialPayDate ? <>Supposed pay {fmtDayDate(s.officialPayDate)}, real pay {fmtDayDate(s.expectedPayDate)}</> : <>Pay date {fmtDayDate(s.expectedPayDate)}</>}
        </div>
      )}
    </Link>
  );
}
