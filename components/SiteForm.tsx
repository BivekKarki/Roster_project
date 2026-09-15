"use client";

import { useActionState, useState } from "react";
import { saveSite } from "@/app/actions/sites";
import { fmtTime, money, plural } from "@/lib/format";
import { FREQUENCIES, FREQUENCY_LABEL, type Frequency, type SiteDTO } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";
import { Alert, Field } from "./ui";

export function SiteForm({ site, employers, defaultDelay, shiftCounts, blankRateCounts }: {
  site: SiteDTO | null;
  employers: string[];
  defaultDelay: number;
  /** "employer|location" -> number of shifts with those names */
  shiftCounts: Record<string, number>;
  /** "employer|location" -> number of non-cancelled shifts with no rate */
  blankRateCounts: Record<string, number>;
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
    notes: site?.notes ?? "",
  });
  const [rename, setRename] = useState(true);
  const [fill, setFill] = useState(true);
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const employer = f.employer.trim();
  const location = f.location.trim();
  const renamed = !!site && (site.employer !== employer || site.location !== location);
  const renameCount = renamed ? shiftCounts[`${site.employer}|${site.location}`] ?? 0 : 0;
  const rateValue = f.defaultRate.trim() === "" ? null : Number(f.defaultRate);
  // Rates are filled after any rename, so count blanks under whichever names the shifts will have.
  const blankKey = renamed && rename ? `${site.employer}|${site.location}` : `${employer}|${location}`;
  const blankCount = rateValue !== null && Number.isFinite(rateValue) ? blankRateCounts[blankKey] ?? 0 : 0;

  return (
    <form action={action}>
      <input type="hidden" name="id" value={site?.id ?? ""} />
      <input type="hidden" name="payFrequency" value={f.payFrequency} />
      <input type="hidden" name="renameExisting" value={renameCount > 0 && rename ? "true" : ""} />
      <input type="hidden" name="fillBlankRates" value={blankCount > 0 && fill ? "true" : ""} />

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
        <div className="grid grid-cols-2 gap-2">
          <Field label="Default rate ($/h)" htmlFor="defaultRate">
            <input id="defaultRate" name="defaultRate" type="number" inputMode="decimal" step="0.01" min="0" placeholder="Not set" value={f.defaultRate} onChange={(e) => set({ defaultRate: e.target.value })} className="input" />
          </Field>
          <Field label="Paid after (days)" htmlFor="payDelayDays">
            <input id="payDelayDays" name="payDelayDays" type="number" inputMode="numeric" min="0" max="120" required value={f.payDelayDays} onChange={(e) => set({ payDelayDays: e.target.value })} className="input" />
          </Field>
        </div>
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
        <Field label="Notes" htmlFor="notes">
          <input id="notes" name="notes" placeholder="Optional, e.g. manager name" value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="input" />
        </Field>

        <Alert>Defaults only fill in <b>new</b> shifts. Existing shifts keep their own times, rates and payment records.</Alert>

        {renameCount > 0 && (
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} className="mt-0.5 h-6 w-6 accent-ink" />
            <span>Also update the name on {plural(renameCount, "existing shift")}. Only the name changes; times, rates and payments stay the same.</span>
          </label>
        )}
        {blankCount > 0 && (
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} className="mt-0.5 h-6 w-6 accent-ink" />
            <span>Fill {money(rateValue)}/h into {plural(blankCount, "existing shift")} with no rate yet. Shifts that already have a rate are not changed.</span>
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
