"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { markPaid, markUnpaid } from "@/app/actions/shifts";
import { PAY_STATE_META, splitPayment, sum } from "@/lib/calc";
import { fmtDate, money, plural, round2, signedMoney } from "@/lib/format";
import type { EnrichedShift } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";
import { Alert, btn, Field } from "./ui";

export function UnpaidList({ unpaid, paid, today }: { unpaid: EnrichedShift[]; paid: EnrichedShift[]; today: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [paying, setPaying] = useState<EnrichedShift[] | null>(null);
  const [notice, setNotice] = useState("");
  const selectedShifts = unpaid.filter((s) => selected.includes(s.id));
  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      {notice && <Alert tone="ok">{notice}</Alert>}

      {selectedShifts.length > 0 ? (
        <div className="sticky top-16 z-10 flex items-center gap-2 rounded-2xl bg-ink p-3 text-white">
          <div className="num flex-1"><b>{selectedShifts.length}</b> selected, {money(sum(selectedShifts, (s) => s.pay))}</div>
          <button type="button" onClick={() => setSelected([])} className="rounded-lg bg-white/15 px-3 py-2 text-sm">Clear</button>
          <button type="button" onClick={() => setPaying(selectedShifts)} className="rounded-lg bg-green-500 px-3 py-2 font-semibold">Mark paid</button>
        </div>
      ) : unpaid.length > 1 ? (
        <button type="button" onClick={() => setSelected(unpaid.map((s) => s.id))} className={`${btn.ghost} w-full`}>
          Select all unpaid ({unpaid.length})
        </button>
      ) : null}

      {unpaid.length === 0 && <p className="py-6 text-center text-slate-500">Nothing unpaid. 🎉</p>}

      {[...unpaid, ...paid].map((s) => {
        const meta = PAY_STATE_META[s.payState ?? "waiting"];
        return (
          <div key={s.id} className={`rounded-2xl border p-3 ${meta.card}`}>
            <div className="flex gap-3">
              {!s.paid && (
                <input type="checkbox" aria-label={`Select ${s.employer} ${fmtDate(s.date)}`} checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)} className="mt-1 h-6 w-6 shrink-0 accent-ink" />
              )}
              <Link href={`/shifts/${s.id}?returnTo=/unpaid`} className="min-w-0 flex-1">
                <div className="font-bold">
                  {meta.icon} {meta.label}
                  {s.payState === "overdue" && `, ${plural(s.daysOverdue, "day")} overdue`}
                  {!s.paid && s.daysUntilDue === 0 && ", due today"}
                  {!s.paid && s.daysUntilDue !== null && s.daysUntilDue > 0 && `, due in ${plural(s.daysUntilDue, "day")}`}
                </div>
                <div className="text-slate-800">{s.employer}, {s.location}</div>
                <dl className="num mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <div><dt className="inline text-slate-500">Shift: </dt><dd className="inline">{fmtDate(s.date)}</dd></div>
                  <div><dt className="inline text-slate-500">Pay due: </dt><dd className="inline">{fmtDate(s.expectedPayDate)}</dd></div>
                  <div><dt className="inline text-slate-500">Hours: </dt><dd className="inline">{round2(s.hours)}</dd></div>
                  <div><dt className="inline text-slate-500">Rate: </dt><dd className="inline">{s.rate === null ? <span className="text-orange-700">not set</span> : money(s.rate)}</dd></div>
                  <div className="col-span-2"><dt className="inline text-slate-500">Expected: </dt><dd className="inline font-bold">{money(s.pay)}</dd>
                    {s.paid && <dd className="inline"> · received {money(s.paidAmount)} on {fmtDate(s.actualPayDate)}{s.difference ? ` (${signedMoney(s.difference)})` : ""}</dd>}
                  </div>
                </dl>
              </Link>
            </div>
            {s.paid ? (
              <form action={markUnpaid} className="mt-2">
                <input type="hidden" name="id" value={s.id} />
                <SubmitButton variant="ghost" pendingText="Updating…" className="w-full text-sm">Undo: mark as unpaid</SubmitButton>
              </form>
            ) : (
              <button type="button" onClick={() => setPaying([s])} className={`${btn.go} mt-3 w-full`}>Mark paid</button>
            )}
          </div>
        );
      })}

      {paying && (
        <PaySheet
          targets={paying}
          today={today}
          onClose={() => setPaying(null)}
          onDone={(message) => {
            setPaying(null);
            setSelected([]);
            setNotice(message);
          }}
        />
      )}
    </>
  );
}

function PaySheet({ targets, today, onClose, onDone }: {
  targets: EnrichedShift[]; today: string; onClose: () => void; onDone: (message: string) => void;
}) {
  const [state, action] = useActionState(markPaid, undefined);
  const single = targets.length === 1;
  const total = sum(targets, (s) => s.pay);
  const [amount, setAmount] = useState(total > 0 ? String(total) : "");
  const [date, setDate] = useState(today);
  const received = amount.trim() === "" ? null : Number(amount);
  const diff = received !== null && Number.isFinite(received) ? round2(received - total) : null;
  const canSplit = targets.every((s) => s.pay !== null && s.pay > 0);
  const preview = !single && canSplit && received !== null ? splitPayment(received, targets.map((s) => s.pay as number)) : null;

  useEffect(() => {
    if (state?.ok) onDone(state.message ?? "Marked paid");
  }, [state, onDone]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/55" role="dialog" aria-modal="true" aria-label="Mark paid">
      <form action={action} className="flex max-h-[94dvh] w-full max-w-md flex-col rounded-t-2xl bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-bold">{single ? "Mark shift paid" : `Mark ${targets.length} shifts paid`}</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1 text-lg" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {targets.map((s) => <input key={s.id} type="hidden" name="ids" value={s.id} />)}
          <div className="num mb-3 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            {targets.slice(0, 10).map((s, i) => (
              <div key={s.id} className="flex justify-between gap-2">
                <span className="truncate">{fmtDate(s.date)} {s.employer}, {s.location}</span>
                <span>{money(s.pay)}{preview && preview[i] !== s.pay ? ` → ${money(preview[i])}` : ""}</span>
              </div>
            ))}
            {targets.length > 10 && <div className="text-slate-500">and {targets.length - 10} more</div>}
            <div className="flex justify-between border-t border-slate-200 pt-1 font-bold"><span>Expected</span><span>{money(total)}</span></div>
          </div>
          <Field label="Payment date" htmlFor="payDate" hint={fmtDate(date)}>
            <input id="payDate" name="payDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="input" />
          </Field>
          <Field label={single ? "Amount received ($)" : "Total received ($)"} htmlFor="amount"
            hint={diff === null ? "Leave blank to record the expected amount." : diff === 0 ? "Matches expected" : `Difference: ${signedMoney(diff)}${!single && canSplit ? ". Split across shifts in proportion to expected pay." : ""}`}>
            <input id="amount" name="amount" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
          </Field>
          <Field label="Payment notes" htmlFor="notes">
            <input id="notes" name="notes" placeholder="Optional, e.g. payslip number" className="input" />
          </Field>
          {state?.error && <Alert tone="error">{state.error}</Alert>}
        </div>
        <div className="border-t border-slate-200 px-4 py-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <SubmitButton variant="go" pendingText="Saving…" className="w-full">Mark paid</SubmitButton>
        </div>
      </form>
    </div>
  );
}
