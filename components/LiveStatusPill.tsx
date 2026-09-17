"use client";

import { useEffect, useState } from "react";
import { displayStatus, shiftPhase, shiftWindow, type ShiftPhase } from "@/lib/shift-time";
import type { Status } from "@/lib/types";
import { useCurrentUser } from "./UserContext";

const STYLE: Record<Status | "IN_PROGRESS", string> = {
  SCHEDULED: "bg-slate-100 text-slate-700 border-slate-300",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-300",
  IN_PROGRESS: "bg-amber-100 text-amber-900 border-amber-400",
  COMPLETED: "bg-green-100 text-green-800 border-green-300",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
};

/** Keeps "now" ticking without contacting the server (so it doesn't keep your login alive). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [intervalMs]);
  return now;
}

/** Scheduled / Confirmed → Working now → Completed, updating live as the clock passes the shift times. */
export function LiveStatusPill({ shift }: {
  shift: { status: Status; autoStatus: boolean; date: string; startTime: string; endTime: string; phase: ShiftPhase };
}) {
  const user = useCurrentUser();
  const now = useNow();
  const phase = now !== null && user && shift.startTime && shift.endTime
    ? shiftPhase(now, shiftWindow(shift.date, shift.startTime, shift.endTime, user.timeZone))
    : shift.phase; // first render matches the server exactly
  const view = displayStatus(shift.status, phase, shift.autoStatus, user?.autoCompleteShifts ?? true);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${STYLE[view.key]}`} data-status={view.key}>
      {view.key === "IN_PROGRESS" && (
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" />
        </span>
      )}
      {view.label}
    </span>
  );
}
