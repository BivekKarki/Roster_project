"use client";

import { useActionState, useState } from "react";
import { saveSite } from "@/app/actions/sites";
import { payDatesFor } from "@/lib/calc";
import { dayName, isIsoDate } from "@/lib/dates";
import { fmtDate, fmtDayDate, fmtTime, money, plural } from "@/lib/format";
import { FREQUENCIES, FREQUENCY_LABEL, WEEKDAYS, type Frequency, type SiteDTO } from "@/lib/types";

export type PayCycleDefaults = { payPeriodStart: string; payPeriodDays: number; payWeekday: number; payLateDays: number };
import { SubmitButton } from "./SubmitButton";
import { Alert, Field } from "./ui";

export function SiteForm({ site, employers, defaultDelay, defaultCycle, today, shiftCounts, blankRateCounts, unpaidCounts }: {
  site: SiteDTO | null;
  /** Pay cycle suggested for a new employer (your other employers' cycle, or the default) */
  defaultCycle: PayCycleDefaults;
  employers: string[];
  defaultDelay: number;
  today: string;
  /** "employer|location" -> number of shifts with those names */
  shiftCounts: Record<string, number>;
  /** "employer|location" -> number of non-cancelled shifts with no rate */
  blankRateCounts: Record<string, number>;
  /** "employer|location" -> number of non-cancelled unpaid shifts */
  unpaidCounts: Record<string, number>;
}) {
  const [state, action] = useActionState(saveSite, undefined);
  const [f, setF] = useState({
    employer: site?.employer ?? "",
    location: site?.location ?? "",
    defaultStart: site?.defaultStart ?? "",
    defaultEnd: site?.defaultEnd ?? "",
    defaultRate: site?.defaultRate === null || site?.defaultRate === undefined ? "" : String(site.defaultRate),
    payFrequency: (site?.payFrequency ?? "FORTNIGHTLY") as Frequency,
    payDelayDays: String(site?.payDelayDays ?? defaultDelay),
    useCycle: site ? site.payPeriodStart !== null && site.payWeekday !== null : true,
    payPeriodStart: site?.payPeriodStart ?? defaultCycle.payPeriodStart,
    payPeriodDays: site?.payPeriodStart ? site.payPeriodDays : defaultCycle.payPeriodDays,
    payWeekday: site?.payWeekday ?? defaultCycle.payWeekday,
    payLateDays: String(site?.payPeriodStart ? site.payLateDays : defaultCycle.payLateDays),
    notes: site?.notes ?? "",
  });
  const [rename, setRename] = useState(true);
  const [fill, setFill] = useState(true);
  const [recalc, setRecalc] = useState(true);
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const employer = f.employer.trim();
  const location = f.location.trim();
  const renamed = !!site && (site.employer !== employer || site.location !== location);
  const renameCount = renamed ? shiftCounts[`${site.employer}|${site.location}`] ?? 0 : 0;
  const rateValue = f.defaultRate.trim() === "" ? null : Number(f.defaultRate);
  // Rates and pay dates are updated after any rename, so count under whichever names the shifts will have.
  const namesKey = renamed && rename ? `${site.employer}|${site.location}` : `${employer}|${location}`;
  const blankCount = rateValue !== null && Number.isFinite(rateValue) ? blankRateCounts[namesKey] ?? 0 : 0;

  const cycle = {
    payPeriodStart: f.useCycle && isIsoDate(f.payPeriodStart) ? f.payPeriodStart : null,
    payPeriodDays: f.payPeriodDays,
    payWeekday: f.useCycle ? f.payWeekday : null,
    payLateDays: Number(f.payLateDays) || 0,
    payDelayDays: Number(f.payDelayDays) || 0,
  };
  const cycleChanged = !site
    || site.payPeriodStart !== cycle.payPeriodStart || site.payWeekday !== cycle.payWeekday
    || site.payPeriodDays !== cycle.payPeriodDays || site.payLateDays !== cycle.payLateDays
    || site.payDelayDays !== cycle.payDelayDays;
  const recalcCount = cycleChanged ? unpaidCounts[namesKey] ?? 0 : 0;
  const preview = payDatesFor(today, cycle, defaultDelay);
  const frequency: Frequency = f.useCycle ? (f.payPeriodDays === 7 ? "WEEKLY" : "FORTNIGHTLY") : f.payFrequency;

  return (
    <form action={action}>
      <input type="hidden" name="id" value={site?.id ?? ""} />
      <input type="hidden" name="payFrequency" value={frequency} />
      <input type="hidden" name="payPeriodStart" value={f.useCycle ? f.payPeriodStart : ""} />
      <input type="hidden" name="payWeekday" value={f.useCycle ? f.payWeekday : ""} />
      <input type="hidden" name="payPeriodDays" value={f.payPeriodDays} />
      <input type="hidden" name="renameExisting" value={renameCount > 0 && rename ? "true" : ""} />
      <input type="hidden" name="fillBlankRates" value={blankCount > 0 && fill ? "true" : ""} />
      <input type="hidden" name="recalcUnpaid" value={recalcCount > 0 && recalc ? "true" : ""} />

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <datalist id="employer-names">{employers.map((e) => <option key={e} value={e} />)}</datalist>
        <Field label="Employer" htmlFor="employer">
          <input id="employer" name="employer" list="employer-names" required placeholder="e.g. Adairs" value={f.employer} onChange={(e) => set({ employer: e.target.value })} className="input" />
        </Field>
        <Field label="Location" htmlFor="location">
          <input id="location" name="location" required placeholder="e.g. Bondi" value={f.location} onChange={(e) => set({ location: e.target.value })} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Default start" htmlFor="defaultStart" hint={f.defaultStart ? fmtTime(f.defaultStart) : "Optional"}>
            <input id="defaultStart" name="defaultStart" type="time" value={f.defaultStart} onChange={(e) => set({ defaultStart: e.target.value })} className="input" />
          </Field>
          <Field label="Default end" htmlFor="defaultEnd" hint={f.defaultEnd ? fmtTime(f.defaultEnd) : "Optional"}>
            <input id="defaultEnd" name="defaultEnd" type="time" value={f.defaultEnd} onChange={(e) => set({ defaultEnd: e.target.value })} className="input" />
          </Field>
        </div>
        <Field label="Default rate ($/h)" htmlFor="defaultRate">
          <input id="defaultRate" name="defaultRate" type="number" inputMode="decimal" step="0.01" min="0" placeholder="Not set" value={f.defaultRate} onChange={(e) => set({ defaultRate: e.target.value })} className="input" />
        </Field>
        <Field label="Notes" htmlFor="notes">
          <input id="notes" name="notes" placeholder="Optional, e.g. manager name" value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="input" />
        </Field>
      </section>

      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-bold">How this employer pays</h2>
        <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment rule">
          {[{ v: true, l: "Pay cycle" }, { v: false, l: "Days after shift" }].map((o) => (
            <button key={o.l} type="button" role="radio" aria-checked={f.useCycle === o.v} onClick={() => set({ useCycle: o.v })}
              className={`rounded-xl border py-3 text-sm font-semibold ${f.useCycle === o.v ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              {o.l}
            </button>
          ))}
        </div>

        {f.useCycle ? (
          <>
            <Field label="A pay period starts on" htmlFor="payPeriodStartInput" hint={isIsoDate(f.payPeriodStart) ? `${dayName(f.payPeriodStart)} ${fmtDate(f.payPeriodStart)}. Use the first day of any pay period, e.g. 14/09/2026.` : ""}>
              <input id="payPeriodStartInput" type="date" required value={f.payPeriodStart} onChange={(e) => set({ payPeriodStart: e.target.value })} className="input" />
            </Field>
            <Field label="Pay period">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pay period length">
                {[{ v: 7, l: "Weekly" }, { v: 14, l: "Fortnightly" }].map((o) => (
                  <button key={o.v} type="button" role="radio" aria-checked={f.payPeriodDays === o.v} onClick={() => set({ payPeriodDays: o.v })}
                    className={`rounded-xl border py-3 text-sm font-semibold ${f.payPeriodDays === o.v ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Supposed pay day" htmlFor="payWeekdaySelect" hint="The first one after the period ends">
                <select id="payWeekdaySelect" value={f.payWeekday} onChange={(e) => set({ payWeekday: Number(e.target.value) })} className="input">
                  {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </Field>
              <Field label="Payroll pays late by (days)" htmlFor="payLateDays" hint="7 = one week later. 0 if on time">
                <input id="payLateDays" name="payLateDays" type="number" inputMode="numeric" min="0" max="60" required value={f.payLateDays} onChange={(e) => set({ payLateDays: e.target.value })} className="input" />
              </Field>
            </div>
            <input type="hidden" name="payDelayDays" value={f.payDelayDays} />
          </>
        ) : (
          <>
            <Field label="Paid after (days)" htmlFor="payDelayDays" hint="Pay date = shift date + this many days">
              <input id="payDelayDays" name="payDelayDays" type="number" inputMode="numeric" min="0" max="120" required value={f.payDelayDays} onChange={(e) => set({ payDelayDays: e.target.value })} className="input" />
            </Field>
            <input type="hidden" name="payLateDays" value={f.payLateDays} />
            <Field label="Normal payment frequency">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment frequency">
                {FREQUENCIES.map((fr) => (
                  <button key={fr} type="button" role="radio" aria-checked={f.payFrequency === fr} onClick={() => set({ payFrequency: fr })}
                    className={`rounded-xl border py-3 text-sm font-semibold ${f.payFrequency === fr ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                    {FREQUENCY_LABEL[fr]}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        <div className="num rounded-xl bg-slate-50 p-3 text-sm">
          <div className="mb-1 text-xs text-slate-500">Example: a shift today, {fmtDayDate(today)}</div>
          {preview.officialPayDate ? (
            <>
              <div>Pay period <b>{fmtDate(preview.periodStart)} to {fmtDate(preview.periodEnd)}</b></div>
              <div>Supposed pay date <b>{fmtDayDate(preview.officialPayDate)}</b></div>
              <div>Real pay date <b>{fmtDayDate(preview.expectedPayDate)}</b></div>
            </>
          ) : (
            <div>Pay date <b>{fmtDayDate(preview.expectedPayDate)}</b></div>
          )}
        </div>
      </section>

      <section className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Alert>Defaults only fill in <b>new</b> shifts. Existing shifts keep their own times, rates, pay dates and payment records.</Alert>
        {renameCount > 0 && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} className="mt-0.5 h-6 w-6 accent-ink" />
            <span>Also update the name on {plural(renameCount, "existing shift")}. Only the name changes; times, rates and payments stay the same.</span>
          </label>
        )}
        {blankCount > 0 && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} className="mt-0.5 h-6 w-6 accent-ink" />
            <span>Fill {money(rateValue)}/h into {plural(blankCount, "existing shift")} with no rate yet. Shifts that already have a rate are not changed.</span>
          </label>
        )}
        {recalcCount > 0 && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={recalc} onChange={(e) => setRecalc(e.target.checked)} className="mt-0.5 h-6 w-6 accent-ink" />
            <span>Recalculate pay dates for {plural(recalcCount, "unpaid shift")} using this payment rule. Paid shifts are never changed.</span>
          </label>
        )}
      </section>

      <div className="bottom-nav-offset sticky z-10 mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
        {state?.error && <div className="mb-2"><Alert tone="error">{state.error}</Alert></div>}
        <SubmitButton className="w-full">{site ? "Save changes" : "Save employer"}</SubmitButton>
      </div>
    </form>
  );
}
