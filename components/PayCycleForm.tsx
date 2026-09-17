"use client";

import { useActionState, useState } from "react";
import { applyPayCycleToAll } from "@/app/actions/settings";
import { payDatesFor } from "@/lib/calc";
import { addDays, dayName, isIsoDate } from "@/lib/dates";
import { fmtDate, fmtDayDate, plural } from "@/lib/format";
import { WEEKDAYS } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";
import { Alert, Field } from "./ui";

export function PayCycleForm({ initial, today, employerCount, unpaidCount }: {
  initial: { payPeriodStart: string; payPeriodDays: number; payWeekday: number; payLateDays: number };
  today: string;
  employerCount: number;
  unpaidCount: number;
}) {
  const [state, action] = useActionState(applyPayCycleToAll, undefined);
  const [start, setStart] = useState(initial.payPeriodStart);
  const [days, setDays] = useState(initial.payPeriodDays);
  const [weekday, setWeekday] = useState(initial.payWeekday);
  const [late, setLate] = useState(String(initial.payLateDays));

  const cycle = { payPeriodStart: isIsoDate(start) ? start : null, payPeriodDays: days, payWeekday: weekday, payLateDays: Number(late) || 0, payDelayDays: 14 };
  const example = isIsoDate(start) ? payDatesFor(start, cycle, 14) : null;
  const next = example?.periodEnd ? payDatesFor(addDays(example.periodEnd, 1), cycle, 14) : null;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="payPeriodDays" value={days} />
      <Field label="A pay period starts on" htmlFor="pc-start" hint={isIsoDate(start) ? `${dayName(start)} ${fmtDate(start)}` : ""}>
        <input id="pc-start" name="payPeriodStart" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className="input" />
      </Field>
      <Field label="Pay period">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pay period length">
          {[{ v: 7, l: "Weekly" }, { v: 14, l: "Fortnightly" }].map((o) => (
            <button key={o.v} type="button" role="radio" aria-checked={days === o.v} onClick={() => setDays(o.v)}
              className={`rounded-xl border py-3 text-sm font-semibold ${days === o.v ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              {o.l}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Supposed pay day" htmlFor="pc-weekday" hint="The first one after the period ends">
          <select id="pc-weekday" name="payWeekday" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="input">
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </Field>
        <Field label="Payroll pays late by (days)" htmlFor="pc-late" hint="7 = one week later">
          <input id="pc-late" name="payLateDays" type="number" inputMode="numeric" min="0" max="60" required value={late} onChange={(e) => setLate(e.target.value)} className="input" />
        </Field>
      </div>

      {example && (
        <div className="num space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
          {[example, next].filter(Boolean).map((p) => (
            <div key={p!.periodStart}>
              <div>Shifts <b>{fmtDate(p!.periodStart)} to {fmtDate(p!.periodEnd)}</b></div>
              <div>Supposed pay date <b>{fmtDayDate(p!.officialPayDate)}</b>, real pay date <b>{fmtDayDate(p!.expectedPayDate)}</b></div>
            </div>
          ))}
        </div>
      )}

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="recalcUnpaid" defaultChecked className="mt-0.5 h-6 w-6 accent-ink" />
        <span>Recalculate pay dates for your {plural(unpaidCount, "unpaid shift")}. Paid shifts are never changed.</span>
      </label>
      <p className="text-xs text-slate-500">The dashboard fortnight follows this pay cycle automatically.</p>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="ok">{state.message}</Alert>}
      <SubmitButton className="w-full" pendingText="Updating…">Apply to all {plural(employerCount, "employer")}</SubmitButton>
      <p className="text-xs text-slate-500">You can still give one employer a different rule from its own page. Today is {fmtDayDate(today)}.</p>
    </form>
  );
}
