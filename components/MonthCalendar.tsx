"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { addMonths, monthGrid, monthLabel, monthOf } from "@/lib/calendar";
import { sum } from "@/lib/calc";
import { dayName } from "@/lib/dates";
import { fmtDate, fmtHours, money, plural } from "@/lib/format";
import type { EnrichedShift } from "@/lib/types";
import { ShiftRow } from "./ShiftRow";
import { btn } from "./ui";

const WEEKDAY_HEADINGS = [
  { short: "M", full: "Monday" }, { short: "T", full: "Tuesday" }, { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" }, { short: "F", full: "Friday" }, { short: "S", full: "Saturday" }, { short: "S", full: "Sunday" },
];
const MAX_DOTS = 3;

export function MonthCalendar({ month, today, initialDay, shifts, colours }: {
  month: string;
  today: string;
  initialDay: string;
  shifts: EnrichedShift[];
  /** employer name -> dot colour */
  colours: Record<string, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialDay);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const grid = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, EnrichedShift[]>();
    for (const s of shifts) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [shifts]);

  const inMonth = shifts.filter((s) => monthOf(s.date) === month && s.status !== "CANCELLED");
  const dayShifts = byDay.get(selected) ?? [];
  const dayActive = dayShifts.filter((s) => s.status !== "CANCELLED");
  const employersThisMonth = [...new Set(shifts.filter((s) => monthOf(s.date) === month).map((s) => s.employer))].sort();
  const hereFor = (day: string) => `/roster?month=${monthOf(day)}&day=${day}`;

  const goMonth = (target: string, day?: string) =>
    router.push(`/roster?month=${target}${day ? `&day=${day}` : ""}`, { scroll: false });

  const pick = (day: string) => {
    if (monthOf(day) !== month) return goMonth(monthOf(day), day);
    setSelected(day);
    window.history.replaceState(null, "", hereFor(day)); // keeps the choice on refresh / back from a shift
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/roster?month=${addMonths(month, -1)}`} replace scroll={false} className="rounded-xl bg-slate-100 px-4 py-3 text-lg" aria-label="Previous month">‹</Link>
          <div className="text-center">
            <h2 className="text-lg font-bold">{monthLabel(month)}</h2>
            <p className="num text-xs text-slate-600">{fmtHours(sum(inMonth, (s) => s.hours))}, {plural(inMonth.length, "shift")}, {money(sum(inMonth, (s) => s.pay))}</p>
          </div>
          <Link href={`/roster?month=${addMonths(month, 1)}`} replace scroll={false} className="rounded-xl bg-slate-100 px-4 py-3 text-lg" aria-label="Next month">›</Link>
        </div>
        {monthOf(today) !== month && (
          <div className="mt-2 text-center">
            <Link href={`/roster?month=${monthOf(today)}&day=${today}`} replace scroll={false} className="text-sm font-semibold text-ink underline">Back to today</Link>
          </div>
        )}

        <div
          className="mt-3"
          onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            if (!start) return;
            const dx = e.changedTouches[0].clientX - start.x;
            const dy = e.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) goMonth(addMonths(month, dx < 0 ? 1 : -1));
          }}
        >
          <div className="grid grid-cols-7 pb-1 text-center text-xs font-semibold text-slate-500" aria-hidden>
            {WEEKDAY_HEADINGS.map((d, i) => <div key={i} className={i >= 5 ? "text-slate-400" : ""}>{d.short}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1" aria-label={`${monthLabel(month)} calendar`} role="group">
            {grid.days.map((day) => {
              const list = byDay.get(day) ?? [];
              const active = list.filter((s) => s.status !== "CANCELLED");
              const isToday = day === today;
              const isSelected = day === selected;
              const otherMonth = monthOf(day) !== month;
              const hours = sum(active, (s) => s.hours);
              const label = `${dayName(day)} ${fmtDate(day)}${isToday ? ", today" : ""}${list.length ? `, ${plural(active.length, "shift")}${hours ? `, ${fmtHours(hours)}` : ""}` : ", no shifts"}`;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  aria-label={label}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  className={`flex h-[4.25rem] flex-col items-center rounded-xl pt-1 transition-colors ${
                    isSelected && !isToday ? "bg-ink-soft ring-2 ring-ink" : isSelected ? "bg-ink-soft" : "active:bg-slate-100"
                  } ${otherMonth ? "opacity-40" : ""}`}
                >
                  <span
                    className={`num flex h-9 w-9 items-center justify-center rounded-full text-base ${
                      isToday ? "bg-ink font-bold text-white shadow-md shadow-ink/30" : "font-semibold text-slate-800"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <span className="mt-1 flex h-2 items-center gap-0.5" aria-hidden>
                    {list.slice(0, MAX_DOTS).map((s) =>
                      s.status === "CANCELLED" ? (
                        <span key={s.id} data-dot="cancelled" className="h-2 w-2 rounded-full border border-slate-400" />
                      ) : (
                        <span key={s.id} data-dot={s.employer} className="h-2 w-2 rounded-full" style={{ background: colours[s.employer] ?? "#6b7280" }} />
                      ),
                    )}
                    {list.length > MAX_DOTS && <span className="text-[9px] font-bold leading-none text-slate-600">+{list.length - MAX_DOTS}</span>}
                  </span>
                  {hours > 0 && <span className="num mt-0.5 text-[10px] leading-none text-slate-500" aria-hidden>{round1(hours)}h</span>}
                </button>
              );
            })}
          </div>
        </div>

        {employersThisMonth.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600" aria-label="Colour key">
            {employersThisMonth.map((name) => (
              <li key={name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colours[name] ?? "#6b7280" }} aria-hidden />
                {name}
              </li>
            ))}
            {shifts.some((s) => s.status === "CANCELLED" && monthOf(s.date) === month) && (
              <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-slate-400" aria-hidden />Cancelled</li>
            )}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-live="polite">
        <div className={`flex items-center justify-between px-3 py-2 ${selected === today ? "bg-ink text-white" : "bg-slate-100"}`}>
          <h2 className="num font-bold">{dayName(selected).toUpperCase()} {fmtDate(selected)}{selected === today ? " (today)" : ""}</h2>
          <span className="num text-sm font-semibold">{dayActive.length ? `${fmtHours(sum(dayActive, (s) => s.hours))} total` : "Free"}</span>
        </div>
        <div className="space-y-2 p-2">
          {dayShifts.length === 0 && <p className="px-1 py-2 text-sm text-slate-500">No shifts on this day.</p>}
          {dayShifts.map((s) => <ShiftRow key={s.id} s={s} returnTo={hereFor(selected)} />)}
          {dayActive.length > 0 && (
            <p className="num px-1 text-xs text-slate-500">Expected pay for the day: {money(sum(dayActive, (s) => s.pay))}</p>
          )}
          <Link href={`/shifts/new?date=${selected}&returnTo=${encodeURIComponent(hereFor(selected))}`} className={`${btn.ghost} w-full border-dashed text-sm`}>
            + Add shift on {dayName(selected)}
          </Link>
        </div>
      </section>
    </>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;
