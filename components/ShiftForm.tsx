"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveShift } from "@/app/actions/shifts";
import { calcHours, calcPay, hasPayCycle, payDatesFor } from "@/lib/calc";
import { dayName, diffDays, isIsoDate } from "@/lib/dates";
import { fmtDate, fmtDayDate, fmtHours, fmtTime, lateness, money, round2, signedMoney } from "@/lib/format";
import { STATUS_LABEL, STATUSES, type SettingsDTO, type ShiftDTO, type SiteDTO, type Status } from "@/lib/types";
import { appTimeZone, automaticStatus, shiftPhase, shiftWindow } from "@/lib/shift-time";
import { LiveStatusPill, useNow } from "./LiveStatusPill";
import { SubmitButton } from "./SubmitButton";
import { useCurrentUser } from "./UserContext";
import { Alert, Field } from "./ui";

const BREAKS = [0, 10, 15, 20, 30, 45, 60];
const REPEATS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12];

type FormState = {
  id: string; siteId: string; employer: string; location: string; date: string;
  startTime: string; endTime: string; breakMins: number; rate: string;
  otEnabled: boolean; otThreshold: string; otMultiplier: string;
  status: Status; autoStatus: boolean; notes: string;
  payPeriodStart: string; payPeriodEnd: string; officialPayDate: string; expectedPayDate: string;
  paid: boolean; actualPayDate: string; actualAmount: string; payNotes: string;
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

  /** All four pay dates for a date + employer, as form strings */
  const datesFor = (d: string, site: SiteDTO | undefined) => {
    const pay = payDatesFor(d, site, settings.payDelayDays);
    return {
      payPeriodStart: pay.periodStart ?? "",
      payPeriodEnd: pay.periodEnd ?? "",
      officialPayDate: pay.officialPayDate ?? "",
      expectedPayDate: pay.expectedPayDate,
    };
  };

  const [f, setF] = useState<FormState>(() => {
    const src = initial ?? template;
    if (src) {
      const copy = !initial; // duplicating: fresh status, fresh pay dates, no payment
      const d = copy ? date : src.date;
      const site = sites.find((s) => s.id === src.siteId);
      return {
        id: initial?.id ?? "", siteId: src.siteId ?? "", employer: src.employer, location: src.location, date: d,
        startTime: src.startTime, endTime: src.endTime, breakMins: src.breakMins, rate: numStr(src.rate),
        otEnabled: src.otThreshold !== null, otThreshold: numStr(src.otThreshold ?? settings.overtimeThreshold),
        otMultiplier: numStr(src.otMultiplier ?? settings.overtimeMultiplier),
        status: copy ? (d < today ? "COMPLETED" : "SCHEDULED") : src.status,
        autoStatus: copy ? true : src.autoStatus,
        notes: src.notes,
        ...(copy
          ? datesFor(d, site)
          : {
              payPeriodStart: src.payPeriodStart ?? "",
              payPeriodEnd: src.payPeriodEnd ?? "",
              officialPayDate: src.officialPayDate ?? "",
              expectedPayDate: src.expectedPayDate ?? "",
            }),
        paid: copy ? false : src.paid,
        actualPayDate: copy ? "" : src.actualPayDate ?? "",
        actualAmount: copy ? "" : numStr(src.actualAmount),
        payNotes: copy ? "" : src.payNotes,
      };
    }
    return {
      id: "", siteId: "", employer: "", location: "", date, startTime: "", endTime: "", breakMins: 0, rate: "",
      otEnabled: settings.overtimeEnabled, otThreshold: String(settings.overtimeThreshold), otMultiplier: String(settings.overtimeMultiplier),
      status: date < today ? "COMPLETED" : "SCHEDULED", autoStatus: true, notes: "",
      ...datesFor(date, undefined),
      paid: false, actualPayDate: "", actualAmount: "", payNotes: "",
    };
  });
  const [repeat, setRepeat] = useState(0);
  const user = useCurrentUser();
  const timeZone = user?.timeZone ?? appTimeZone();
  const autoEnabled = user?.autoCompleteShifts ?? settings.autoCompleteShifts;
  const now = useNow();
  // Existing shifts: don't second-guess the saved status until you change the date, times or status.
  const [statusTouched, setStatusTouched] = useState(!!initial);
  const set = (patch: Partial<FormState>) => setF((p) => ({ ...p, ...patch }));

  const siteFor = (employer: string, location: string) => sites.find((s) => s.employer === employer && s.location === location);

  // Selecting an employer + location fills in its defaults and pay dates. Everything stays editable.
  const applySite = (site: SiteDTO) =>
    setF((p) => ({
      ...p,
      siteId: site.id, employer: site.employer, location: site.location,
      startTime: site.defaultStart ?? p.startTime, endTime: site.defaultEnd ?? p.endTime,
      rate: numStr(site.defaultRate),
      ...(isIsoDate(p.date) ? datesFor(p.date, site) : {}),
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
    setF((p) => ({ ...p, date: value, ...datesFor(value, siteFor(p.employer, p.location)) }));
  };

  const employers = useMemo(() => [...new Set([...sites.map((s) => s.employer), f.employer].filter(Boolean))].sort(), [sites, f.employer]);
  const locations = [...new Set([...sites.filter((s) => s.employer === f.employer).map((s) => s.location), f.location].filter(Boolean))].sort();
  const quickPicks = isNew ? [...sites].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0)).slice(0, 6) : [];
  const currentSite = siteFor(f.employer, f.location);

  const hours = calcHours(f.startTime, f.endTime, f.breakMins);
  const pay = calcPay(hours, toNum(f.rate), f.otEnabled ? toNum(f.otThreshold) : null, f.otEnabled ? toNum(f.otMultiplier) : null);
  const actual = toNum(f.actualAmount);
  const diff = f.paid && actual !== null && pay !== null ? round2(actual - pay) : null;
  const completed = f.status === "COMPLETED";
  const hasTimes = isIsoDate(f.date) && /^\d\d:\d\d$/.test(f.startTime) && /^\d\d:\d\d$/.test(f.endTime);
  const window_ = hasTimes ? shiftWindow(f.date, f.startTime, f.endTime, timeZone) : null;
  const phase = window_ && now !== null ? shiftPhase(now, window_) : null;
  const endLabel = window_
    ? new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "short", day: "2-digit", month: "2-digit", hour: "numeric", minute: "2-digit", hour12: true }).format(window_.endMs)
    : "";

  // New shifts follow the clock until you pick a status: a shift that has already ended starts as Completed.
  useEffect(() => {
    if (statusTouched || !autoEnabled || !phase) return;
    setF((p) => {
      const base: Status = p.status === "COMPLETED" && phase !== "finished" ? "SCHEDULED" : p.status;
      const next = automaticStatus(base, phase);
      return next === p.status && p.autoStatus ? p : { ...p, status: next, autoStatus: true };
    });
  }, [phase, statusTouched, autoEnabled]);

  function statusHint() {
    if (!autoEnabled) return "Automatic status is off in Settings.";
    if (f.status === "CANCELLED") return "Cancelled shifts never change automatically.";
    if (!f.autoStatus) return "You set this status yourself, so it won't change automatically.";
    if (!phase) return "Status updates automatically from the shift times.";
    if (phase === "upcoming") return `Shows Working now during the shift and becomes Completed at ${endLabel}.`;
    if (phase === "in-progress") return `Becomes Completed automatically at ${endLabel}.`;
    return f.status === "COMPLETED" ? "This shift has ended, so it's Completed." : "";
  }

  const pickStatus = (s: Status) => {
    setStatusTouched(true);
    // Choosing Scheduled/Confirmed for a shift that has already ended means "keep it like this".
    const manual = (s === "SCHEDULED" || s === "CONFIRMED") && phase === "finished";
    setF((p) => ({ ...p, status: s, autoStatus: !manual }));
  };
  const expectedVsOfficial = isIsoDate(f.officialPayDate) && isIsoDate(f.expectedPayDate) ? diffDays(f.expectedPayDate, f.officialPayDate) : null;
  const paidVsOfficial = f.paid && isIsoDate(f.officialPayDate) && isIsoDate(f.actualPayDate) ? diffDays(f.actualPayDate, f.officialPayDate) : null;

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={f.id} />
      <input type="hidden" name="siteId" value={f.siteId} />
      <input type="hidden" name="status" value={f.status} />
      <input type="hidden" name="autoStatus" value={f.autoStatus ? "true" : ""} />
      <input type="hidden" name="paid" value={f.paid ? "true" : ""} />
      <input type="hidden" name="otEnabled" value={f.otEnabled ? "true" : ""} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="repeatWeeks" value={repeat} />
      <input type="hidden" name="payPeriodStart" value={f.payPeriodStart} />
      <input type="hidden" name="payPeriodEnd" value={f.payPeriodEnd} />
      <input type="hidden" name="officialPayDate" value={f.officialPayDate} />

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

        <Field label="Status" hint={statusHint()}>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Status">
            {STATUSES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={f.status === s} onClick={() => pickStatus(s)}
                className={`rounded-xl border py-3 text-sm font-semibold ${f.status === s ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {phase && hasTimes && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-slate-600">Right now:</span>
              <LiveStatusPill shift={{ status: f.status, autoStatus: f.autoStatus, date: f.date, startTime: f.startTime, endTime: f.endTime, phase }} />
            </div>
          )}
          {!f.autoStatus && autoEnabled && (
            <button type="button" onClick={() => { setStatusTouched(false); setF((p) => ({ ...p, autoStatus: true })); }}
              className="mt-2 text-sm font-semibold text-ink underline">
              Turn automatic status back on
            </button>
          )}
        </Field>

        {isNew && (
          <Field label="Repeat every week" htmlFor="repeat" hint={repeat ? `Also adds this shift on the same weekday for the next ${repeat} week${repeat > 1 ? "s" : ""}. Each one gets its own pay dates.` : undefined}>
            <select id="repeat" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))} className="input">
              {REPEATS.map((n) => <option key={n} value={n}>{n === 0 ? "Don't repeat" : `Next ${n} week${n > 1 ? "s" : ""}`}</option>)}
            </select>
          </Field>
        )}

        <Field label="Notes" htmlFor="notes">
          <input id="notes" name="notes" placeholder="Optional" value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="input" />
        </Field>
      </section>

      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-bold">Pay dates</h2>
        {f.officialPayDate ? (
          <dl className="num mb-3 grid grid-cols-2 gap-2 text-sm">
            <div className="col-span-2 rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Pay period</dt>
              <dd className="font-semibold">{fmtDate(f.payPeriodStart)} to {fmtDate(f.payPeriodEnd)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Supposed pay date</dt>
              <dd className="font-semibold">{fmtDayDate(f.officialPayDate)}</dd>
            </div>
            <div className="rounded-xl bg-yellow-50 p-3">
              <dt className="text-xs text-slate-500">Real pay date</dt>
              <dd className="font-semibold">{fmtDayDate(f.expectedPayDate)}</dd>
              {expectedVsOfficial !== null && expectedVsOfficial !== 0 && <dd className="text-xs text-slate-600">{lateness(expectedVsOfficial)} (payroll)</dd>}
            </div>
          </dl>
        ) : (
          <p className="mb-3 text-xs text-slate-500">
            {currentSite && !hasPayCycle(currentSite)
              ? "This employer has no pay cycle yet, so the pay date is just the shift date plus a number of days. Set up the pay cycle in Settings to get the supposed and real pay dates."
              : "Choose an employer to work out the pay dates."}
          </p>
        )}
        <Field label="Real pay date (change it if payroll tells you a different day)" htmlFor="expectedPayDate" hint={fmtDayDate(f.expectedPayDate)}>
          <input id="expectedPayDate" name="expectedPayDate" type="date" value={f.expectedPayDate} onChange={(e) => set({ expectedPayDate: e.target.value })} className="input" />
        </Field>
      </section>

      {/* Payment fields stay in the form even when hidden, so changing status never wipes payment history. */}
      <section className={`mt-3 rounded-2xl border border-slate-200 bg-white p-4 ${completed ? "" : "hidden"}`}>
        <h2 className="mb-2 font-bold">Payment received</h2>
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
          <Field label="Received on" htmlFor="actualPayDate" hint={paidVsOfficial !== null ? `${fmtDayDate(f.actualPayDate)}, ${lateness(paidVsOfficial)}` : fmtDayDate(f.actualPayDate)}>
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
