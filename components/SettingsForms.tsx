"use client";

import { useActionState, useState } from "react";
import { importBackup } from "@/app/actions/data";
import { updateSettings } from "@/app/actions/settings";
import { dayName } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import type { SettingsDTO } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";
import { Alert, Field } from "./ui";

export function GeneralSettingsForm({ settings }: { settings: SettingsDTO }) {
  const [state, action] = useActionState(updateSettings, undefined);
  const [fortnightStart, setFortnightStart] = useState(settings.fortnightStart);
  const [overtime, setOvertime] = useState(settings.overtimeEnabled);

  return (
    <form action={action} className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-bold">Payments and fortnights</h2>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Default paid after (days)" htmlFor="payDelayDays" hint="Used for new employers">
            <input id="payDelayDays" name="payDelayDays" type="number" inputMode="numeric" min="0" max="120" defaultValue={settings.payDelayDays} className="input" />
          </Field>
          <Field label="Due soon window (days)" htmlFor="dueSoonDays" hint="When 🟡 appears">
            <input id="dueSoonDays" name="dueSoonDays" type="number" inputMode="numeric" min="0" max="60" defaultValue={settings.dueSoonDays} className="input" />
          </Field>
        </div>
        <Field label="A fortnight starts on" htmlFor="fortnightStart" hint={`${dayName(fortnightStart)} ${fmtDate(fortnightStart)}. Every fortnight is counted from this date.`}>
          <input id="fortnightStart" name="fortnightStart" type="date" required value={fortnightStart} onChange={(e) => setFortnightStart(e.target.value)} className="input" />
        </Field>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-bold">Overtime</h2>
        <label className="mb-3 flex items-center gap-3">
          <input type="checkbox" name="overtimeEnabled" checked={overtime} onChange={(e) => setOvertime(e.target.checked)} className="h-6 w-6 accent-ink" />
          <span>Calculate overtime on new shifts</span>
        </label>
        <div className={`grid grid-cols-2 gap-2 ${overtime ? "" : "hidden"}`}>
          <Field label="After (hours per shift)" htmlFor="overtimeThreshold">
            <input id="overtimeThreshold" name="overtimeThreshold" type="number" inputMode="decimal" step="0.25" min="0" max="24" defaultValue={settings.overtimeThreshold} className="input" />
          </Field>
          <Field label="Pay multiplier" htmlFor="overtimeMultiplier">
            <input id="overtimeMultiplier" name="overtimeMultiplier" type="number" inputMode="decimal" step="0.05" min="1" max="5" defaultValue={settings.overtimeMultiplier} className="input" />
          </Field>
        </div>
        <p className="text-xs text-slate-500">Each shift keeps the overtime rule it was saved with.</p>
      </section>

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="ok">{state.message}</Alert>}
      <SubmitButton className="w-full">Save settings</SubmitButton>
    </form>
  );
}

export function ImportForm() {
  const [state, action] = useActionState(importBackup, undefined);
  const [showPaste, setShowPaste] = useState(false);
  return (
    <form action={action} className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      <h3 className="font-semibold">Import a backup</h3>
      <p className="text-xs text-slate-500">Works with ShiftBook backups and with backup text from the earlier Claude version of this tracker.</p>
      <input type="file" name="file" accept=".json,application/json,text/plain" className="input" aria-label="Backup file" />
      <button type="button" onClick={() => setShowPaste(!showPaste)} className="text-sm text-ink underline">
        {showPaste ? "Hide paste box" : "Or paste backup text instead"}
      </button>
      {showPaste && <textarea name="text" rows={6} className="input font-mono text-xs" placeholder="Paste backup text here" />}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="replace" className="mt-0.5 h-6 w-6 accent-ink" />
        <span>Replace all my current shifts and employers. Leave unticked to add to what's already here.</span>
      </label>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="ok">{state.message}</Alert>}
      <SubmitButton variant="ghost" pendingText="Importing…" className="w-full">Import</SubmitButton>
    </form>
  );
}
