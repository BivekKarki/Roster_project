import type { Metadata } from "next";
import Link from "next/link";
import { ShiftRow } from "@/components/ShiftRow";
import { btn, Card, Field, Page, PageHeader } from "@/components/ui";
import { summarize } from "@/lib/calc";
import { findShifts, getSettings, getSites } from "@/lib/data";
import { fmtHours, money } from "@/lib/format";
import { filtersToQuery, filtersToWhere, readFilters } from "@/lib/filters";
import { intParam, type SearchParams } from "@/lib/params";
import { requireUserId } from "@/lib/session";
import { STATUS_LABEL, STATUSES } from "@/lib/types";

export const metadata: Metadata = { title: "All shifts" };

const PAGE = 100;

export default async function ShiftsPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const filters = readFilters(sp);
  const limit = intParam(sp.limit, PAGE, PAGE, 5000);
  const settings = await getSettings(userId);

  const [sites, found] = await Promise.all([
    getSites(userId), // cached: also gives the filter dropdown options
    findShifts(userId, filtersToWhere(filters), settings, { orderBy: [{ date: "desc" }, { startTime: "asc" }] }),
  ]);
  const names = [...sites.map((s) => ({ employer: s.employer, location: s.location })), ...found.map((s) => ({ employer: s.employer, location: s.location }))];
  const shifts = filters.payment === "overdue" ? found.filter((s) => s.payState === "overdue") : found;
  const st = summarize(shifts);
  const employers = [...new Set(names.map((n) => n.employer))].sort();
  const locations = [...new Set(names.filter((n) => !filters.employer || n.employer === filters.employer).map((n) => n.location))].sort();
  const query = filtersToQuery(filters);
  const activeCount = [filters.employer, filters.location, filters.status, filters.payment, filters.from, filters.to].filter(Boolean).length;
  const here = `/shifts${query ? `?${query}` : ""}`;

  return (
    <>
      <PageHeader title="All shifts" subtitle={`${shifts.length} found`} />
      <Page>
        <Card>
          <form action="/shifts">
            <input name="q" defaultValue={filters.q} placeholder="Search employer, location or notes" className="input" aria-label="Search" />
            <details className="mt-2" open={activeCount > 0}>
              <summary className="cursor-pointer select-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-semibold text-slate-700">
                Filters{activeCount ? ` (${activeCount})` : ""}
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Field label="Employer" htmlFor="f-employer">
                  <select id="f-employer" name="employer" defaultValue={filters.employer} className="input">
                    <option value="">All</option>{employers.map((e) => <option key={e}>{e}</option>)}
                  </select>
                </Field>
                <Field label="Location" htmlFor="f-location">
                  <select id="f-location" name="location" defaultValue={filters.location} className="input">
                    <option value="">All</option>{locations.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Status" htmlFor="f-status">
                  <select id="f-status" name="status" defaultValue={filters.status} className="input">
                    <option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </Field>
                <Field label="Payment" htmlFor="f-payment">
                  <select id="f-payment" name="payment" defaultValue={filters.payment} className="input">
                    <option value="">All</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="overdue">Overdue</option>
                    <option value="paid">Paid</option>
                    <option value="norate">No rate</option>
                  </select>
                </Field>
                <Field label="From" htmlFor="f-from"><input id="f-from" type="date" name="from" defaultValue={filters.from} className="input" /></Field>
                <Field label="To" htmlFor="f-to"><input id="f-to" type="date" name="to" defaultValue={filters.to} className="input" /></Field>
              </div>
            </details>
            <div className="mt-2 flex gap-2">
              <button type="submit" className={`${btn.primary} flex-1`}>Apply</button>
              {(activeCount > 0 || filters.q) && <Link href="/shifts" className={btn.ghost}>Clear</Link>}
            </div>
          </form>
          <div className="num mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2"><div className="text-xs text-slate-500">Shifts</div><div className="font-bold">{st.shifts}</div></div>
            <div className="rounded-xl bg-slate-50 p-2"><div className="text-xs text-slate-500">Hours</div><div className="font-bold">{fmtHours(st.hours)}</div></div>
            <div className="rounded-xl bg-slate-50 p-2"><div className="text-xs text-slate-500">Expected</div><div className="font-bold">{money(st.expected)}</div></div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={`/api/export/csv${query ? `?${query}` : ""}`} className={btn.ghost}>Export CSV</a>
            <a href={`/api/export/xlsx${query ? `?${query}` : ""}`} className={btn.ghost}>Export Excel</a>
          </div>
        </Card>

        {shifts.length === 0 && <p className="py-6 text-center text-slate-500">No shifts match. Clear the filters or add a shift.</p>}
        <div className="space-y-2">
          {shifts.slice(0, limit).map((s) => <ShiftRow key={s.id} s={s} showDate returnTo={here} />)}
        </div>
        {shifts.length > limit && (
          <Link href={`/shifts?${query}${query ? "&" : ""}limit=${limit + PAGE}`} scroll={false} className={`${btn.ghost} w-full`}>
            Show more ({shifts.length - limit} left)
          </Link>
        )}
      </Page>
    </>
  );
}
