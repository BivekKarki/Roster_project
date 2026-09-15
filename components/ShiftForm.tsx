"use client";

import { useActionState, useMemo, useState } from "react";
import { saveShift } from "@/app/actions/shifts";
import { calcHours, calcPay } from "@/lib/calc";
import { addDays, dayName, isIsoDate } from "@/lib/dates";
import { fmtDate, fmtHours, fmtTime, money, round2, signedMoney } from "@/lib/format";
import { STATUS_LABEL, STATUSES, type SettingsDTO, type ShiftDTO, type SiteDTO, type Status } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";
import { Alert, Field } from "./ui";

const BREAKS = [0, 10, 15, 20, 30, 45, 60];
const REPEATS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12];

type FormState = {
  id: string; siteId: string; employer: string; location: string; date: string;
  startTime: string; endTime: string; breakMins: number; rate: string;
  otEnabled: boolean; otThreshold: string; otMultiplier: string;
  status: Status; notes: string; expectedPayDate: string; paid: boolean;
  actualPayDate: string; actualAmount: string; payNotes: string;
};

const numStr = (n: number | null) => (n === null ? "" : String(n));
const toNum = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));

export type ShiftFormProps = {
  sites: SiteDTO[];
  settings: SettingsDTO;
  initial: ShiftDTO | null;
  template: ShiftDTO | null;
  date: string;
  today: string;
  returnTo: string;
  usage: Record<string, number>;
};

export function ShiftForm({ sites, settings, initial, template, date, today, returnTo, usage }: ShiftFormProps) {
  const [state, formAction] = useActionState(saveShift, undefined);
  const isNew = !initial;

  const [f, setF] = useState<FormState>(() => {
    const src = initial ?? template;
    if (src) {
      const copy = !initial; // duplicating: fresh status and no payment
      const d = copy ? date : src.date;
      return {
        id: initial?.id ?? "", siteId: src.siteId ?? "", employer: src.employer, location: src.location, date: d,
        startTime: src.startTime, endTime: src.endTime, breakMins: src.breakMins, rate: numStr(src.rate),
        otEnabled: src.otThreshold !== null, otThreshold: numStr(src.otThreshold ?? settings.overtimeThreshold),
        otMultiplier: numStr(src.otMultiplier ?? settings.overtimeMultiplier),
        status: copy ? (d < today ? "COMPLETED" : "SCHEDULED") : src.status,
        notes: src.notes,
        expectedPayDate: copy
          ? addDays(d, sites.find((s) => s.id === src.siteId)?.payDelayDays ?? settings.payDelayDays)
          : src.expectedPayDate ?? "",
        paid: copy ? false : src.paid,
        actualPayDate: copy ? "" : src.actualPayDate ?? "",
        actualAmount: copy ? "" : numStr(src.actualAmount),
        payNotes: copy ? "" : src.payNotes,
      };
    }
    return {
      id: "", siteId: "", employer: "", location: "", date, startTime: "", endTime: "", breakMins: 0, rate: "",
      otEnabled: settings.overtimeEnabled, otThreshold: String(settings.overtimeThreshold), otMultiplier: String(settings.overtimeMultiplier),
      status: date < today ? "COMPLETED" : "SCHEDULED", notes: "",
      expectedPayDate: addDays(date, settings.payDelayDays), paid: false, actualPayDate: "", actualAmount: "", payNotes: "",
    };
  });
  const [repeat, setRepeat] = useState(0);
  const set = (patch: Partial<FormState>) => setF((p) => ({ ...p, ...patch }));

  const siteFor = (employer: string, location: string) => sites.find((s) => s.employer === employer && s.location === location);
  const delayFor = (site?: SiteDTO) => site?.payDelayDays ?? settings.payDelayDays;

  // Selecting an employer + location fills in its defaults. Everything stays editable.
  const applySite = (site: SiteDTO) =>
    setF((p) => ({
      ...p,
      siteId: site.id, employer: site.employer, location: site.location,
      startTime: site.defaultStart ?? p.startTime, endTime: site.defaultEnd ?? p.endTime,
      rate: numStr(site.defaultRate),
      expectedPayDate: isIsoDate(p.date) ? addDays(p.date, delayFor(site)) : p.expectedPayDate,
    }));

  const onEmployer = (employer: string) => {
    const locs = sites.filter((s) => s.employer === employer);
    if (locs.length === 1) applySite(locs[0]);
    else set({ employer, location: "", siteId: "" });
  };
  const onLocation = (location: string) => {
    const site = siteFor(f.employer, location);
    if (site) applySite(site);
    else set({ location, siteId: "" });
  };
  const onDate = (value: string) => {
    if (!isIsoDate(value)) return set({ date: value });
    setF((p) => ({ ...p, date: value, expectedPayDate: addDays(value, delayFor(siteFor(p.employer, p.location))) }));
  };

  const employers = useMemo(() => [...new Set([...sites.map((s) => s.employer), f.employer].filter(Boolean))].sort(), [sites, f.employer]);
  const locations = [...new Set([...sites.filter((s) => s.employer === f.employer).map((s) => s.location), f.location].filter(Boolean))].sort();
  const quickPicks = isNew ? [...sites].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0)).slice(0, 6) : [];

  const hours = calcHours(f.startTime, f.endTime, f.breakMins);
  const pay = calcPay(hours, toNum(f.rate), f.otEnabled ? toNum(f.otThreshold) : null, f.otEnabled ? toNum(f.otMultiplier) : null);
  const actual = toNum(f.actualAmount);
  const diff = f.paid && actual !== null && pay !== null ? round2(actual - pay) : null;
  const completed = f.status === "COMPLETED";

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={f.id} />
      <input type="hidden" name="siteId" value={f.siteId} />
      <input type="hidden" name="status" value={f.status} />
      <input type="hidden" name="paid" value={f.paid ? "true" : ""} />
      <input type="hidden" name="otEnabled" value={f.otEnabled ? "true" : ""} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="repeatWeeks" value={repeat} />

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        {quickPicks.length > 0 && (
          <Field label="Quick pick">
            <div className="flex flex-wrap gap-2">
              {quickPicks.map((s) => {
                const on = f.employer === s.employer && f.location === s.location;
                return (
                  <button key={s.id} type="button" onClick={() => applySite(s)} aria-pressed={on}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold ${on ? "border-ink bg-ink text-white" : "border-ink-soft bg-ink-soft text-ink"}`}>
                    {s.employer}, {s.location}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        {sites.length === 0 && <div className="mb-3"><Alert tone="warn">Add your employers in Settings first so they appear here.</Alert></div>}

        <Field label="Date" htmlFor="date" hint={isIsoDate(f.date) ? `${dayName(f.date)} ${fmtDate(f.date)}` : ""}>
          <input id="date" name="date" type="date" required value={f.date} onChange={(e) => onDate(e.target.value)} className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Employer" htmlFor="employer">
            <select id="employer" name="employer" required value={f.employer} onChange={(e) => onEmployer(e.target.value)} className="input">
              <option value="">Choose</option>
              {employers.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Location" htmlFor="location">
            <select id="location" name="location" required value={f.location} onChange={(e) => onLocation(e.target.value)} disabled={!f.employer} className="input">
              <option value="">Choose</option>
              {locations.map((x) => <option key={x}>{x}</option>)}
            </select>
            {!f.employer && <input type="hidden" name="location" value="" />}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Start" htmlFor="startTime" hint={fmtTime(f.startTime)}>
            <input id="startTime" name="startTime" type="time" required value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} className="input" />
          </Field>
          <Field label="End" htmlFor="endTime" hint={fmtTime(f.endTime)}>
            <input id="endTime" name="endTime" type="time" required value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Break (unpaid)" htmlFor="breakMins">
            <select id="breakMins" name="breakMins" value={f.breakMins} onChange={(e) => set({ breakMins: Number(e.target.value) })} className="input">
              {[...new Set([...BREAKS, f.breakMins])].sort((a, b) => a - b).map((b) => <option key={b} value={b}>{b === 0 ? "No break" : `${b} min`}</option>)}
            </select>
          </Field>
          <Field label="Hourly rate ($)" htmlFor="rate">
            <input id="rate" name="rate" type="number" inputMode="decimal" step="0.01" min="0" placeholder="Not set" value={f.rate} onChange={(e) => set({ rate: e.target.value })} className="input" />
          </Field>
        </div>

        {(f.otEnabled || settings.overtimeEnabled) && (
          <div className="mb-3 rounded-xl border border-slate-200 p-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={f.otEnabled} onChange={(e) => set({ otEnabled: e.target.checked })} className="h-6 w-6 accent-ink" />
              Apply overtime to this shift
            </label>
            {f.otEnabled && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="After (hours)" htmlFor="otThreshold">
                  <input id="otThreshold" name="otThreshold" type="number" inputMode="decimal" step="0.25" min="0" value={f.otThreshold} onChange={(e) => set({ otThreshold: e.target.value })} className="input" />
                </Field>
                <Field label="Multiplier" htmlFor="otMultiplier">
                  <input id="otMultiplier" name="otMultiplier" type="number" inputMode="decimal" step="0.05" min="1" value={f.otMultiplier} onChange={(e) => set({ otMultiplier: e.target.value })} className="input" />
                </Field>
              </div>
            )}
          </div>
        )}

        <Field label="Status">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Status">
            {STATUSES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={f.status === s} onClick={() => set({ status: s })}
                className={`rounded-xl border py-3 text-sm font-semibold ${f.status === s ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Field>

        {isNew && (
          <Field label="Repeat every week" htmlFor="repeat" hint={repeat ? `Also adds this shift on the same weekday for the next ${repeat} week${repeat > 1 ? "s" : ""}.` : undefined}>
            <select id="repeat" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))} className="input">
              {REPEATS.map((n) => <option key={n} value={n}>{n === 0 ? "Don't repeat" : `Next ${n} week${n > 1 ? "s" : ""}`}</option>)}
            </select>
          </Field>
        )}

        <Field label="Notes" htmlFor="notes">
          <input id="notes" name="notes" placeholder="Optional" value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="input" />
        </Field>
      </section>

      {/* Payment fields stay in the form even when hidden, so changing status never wipes payment history. */}
      <section className={`mt-3 rounded-2xl border border-slate-200 bg-white p-4 ${completed ? "" : "hidden"}`}>
        <h2 className="mb-2 font-bold">Payment</h2>
        <Field label="Expected payment date" htmlFor="expectedPayDate" hint={fmtDate(f.expectedPayDate)}>
          <input id="expectedPayDate" name="expectedPayDate" type="date" value={f.expectedPayDate} onChange={(e) => set({ expectedPayDate: e.target.value })} className="input" />
        </Field>
        <Field label="Paid?">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Paid">
            {[false, true].map((v) => (
              <button key={String(v)} type="button" role="radio" aria-checked={f.paid === v}
                onClick={() => setF((p) => ({
                  ...p, paid: v,
                  actualPayDate: v && !p.actualPayDate ? today : p.actualPayDate,
                  actualAmount: v && p.actualAmount === "" && pay !== null ? String(pay) : p.actualAmount,
                }))}
                className={`rounded-xl border py-3 text-sm font-semibold ${f.paid === v ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                {v ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </Field>
        <div className={`grid grid-cols-2 gap-2 ${f.paid ? "" : "hidden"}`}>
          <Field label="Paid on" htmlFor="actualPayDate" hint={fmtDate(f.actualPayDate)}>
            <input id="actualPayDate" name="actualPayDate" type="date" value={f.actualPayDate} onChange={(e) => set({ actualPayDate: e.target.value })} className="input" />
          </Field>
          <Field label="Received ($)" htmlFor="actualAmount" hint={diff === null ? "" : diff === 0 ? "Matches expected" : `Difference: ${signedMoney(diff)}`}>
            <input id="actualAmount" name="actualAmount" type="number" inputMode="decimal" step="0.01" min="0" value={f.actualAmount} onChange={(e) => set({ actualAmount: e.target.value })} className="input" />
          </Field>
        </div>
        <Field label="Payment notes" htmlFor="payNotes">
          <input id="payNotes" name="payNotes" placeholder="Optional" value={f.payNotes} onChange={(e) => set({ payNotes: e.target.value })} className="input" />
        </Field>
      </section>

      <div className="bottom-nav-offset sticky z-10 mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
        {state?.error && <div className="mb-2"><Alert tone="error">{state.error}</Alert></div>}
        <div className="num mb-2 flex items-center justify-between">
          <span className="text-slate-600">{fmtHours(hours)}{toNum(f.rate) !== null ? ` at ${money(toNum(f.rate))}/h` : ""}</span>
          <span className="text-xl font-bold">{pay === null ? <span className="text-base text-orange-600">No rate yet</span> : money(pay)}</span>
        </div>
        <SubmitButton className="w-full" pendingText="Saving…">
          {isNew ? (repeat ? `Save ${repeat + 1} shifts` : "Save shift") : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
