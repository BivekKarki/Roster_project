import type { Metadata } from "next";
import Link from "next/link";
import { UnpaidList } from "@/components/UnpaidList";
import { Card, Page, PageHeader } from "@/components/ui";
import { payDatesFor, sum } from "@/lib/calc";
import { findShifts, getOpenPastShifts, getSettings, getUnpaidShifts } from "@/lib/data";
import { addDays, isIsoDate, isoToDb, todayIso } from "@/lib/dates";
import { fmtDate, fmtDayDate, money, plural } from "@/lib/format";
import { suggestedPayCycle } from "@/lib/payCycleDefaults";
import { one, type SearchParams } from "@/lib/params";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Unpaid" };

export default async function UnpaidPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const employer = one(sp.employer);
  const showPaid = one(sp.show) === "paid";
  const grouped = one(sp.view) !== "list";
  const [settings, payCycle] = await Promise.all([getSettings(userId), suggestedPayCycle(userId)]);
  const today = todayIso();
  const showAll = one(sp.period) === "all";

  const [allUnpaid, paid, openPast] = await Promise.all([
    getUnpaidShifts(userId), // cached: the layout already loaded this for the nav badge
    showPaid
      ? findShifts(userId, { status: "COMPLETED", paid: true, actualPayDate: { gte: isoToDb(addDays(today, -90)) }, ...(employer ? { employer } : {}) }, settings, { orderBy: [{ actualPayDate: "desc" }] })
      : Promise.resolve([]),
    getOpenPastShifts(userId), // cached
  ]);
  const names = [...new Set(allUnpaid.map((s) => s.employer))].sort().map((e) => ({ employer: e }));
  const openCount = openPast.filter((s) => s.phase === "finished").length;

  // One pay period at a time, so the total matches what should land in your account.
  const cycle = payCycle.fromEmployers ? { ...payCycle, payDelayDays: settings.payDelayDays } : null;
  const periodLength = cycle?.payPeriodDays ?? 14;
  const currentPeriod = cycle ? payDatesFor(today, cycle, settings.payDelayDays) : null;
  const requested = one(sp.period);
  const periodStart = !showAll && cycle
    ? (isIsoDate(requested) ? payDatesFor(requested, cycle, settings.payDelayDays).periodStart : currentPeriod!.periodStart)
    : null;
  const period = periodStart ? payDatesFor(periodStart, cycle!, settings.payDelayDays) : null;

  const inPeriod = (s: (typeof allUnpaid)[number]) =>
    !period ? true : s.payPeriodStart ? s.payPeriodStart === period.periodStart : s.date >= period.periodStart! && s.date <= period.periodEnd!;

  const unpaidRaw = allUnpaid.filter((s) => (employer ? s.employer === employer : true) && inPeriod(s));
  const allUnpaidTotal = sum(allUnpaid.filter((s) => (employer ? s.employer === employer : true)), (s) => s.pay);
  const outsideCount = allUnpaid.filter((s) => (employer ? s.employer === employer : true)).length - unpaidRaw.length;

  const unpaid = [...unpaidRaw].sort((a, b) =>
    (a.expectedPayDate ?? "9999").localeCompare(b.expectedPayDate ?? "9999") || a.date.localeCompare(b.date));
  const groups = {
    overdue: unpaid.filter((s) => s.payState === "overdue"),
    soon: unpaid.filter((s) => s.payState === "soon"),
    waiting: unpaid.filter((s) => s.payState === "waiting"),
  };
  const link = (params: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries({
      employer, show: showPaid ? "paid" : "", view: grouped ? "" : "list",
      period: showAll ? "all" : (period && period.periodStart !== currentPeriod?.periodStart ? period.periodStart! : ""),
      ...params,
    }).filter(([, v]) => v)).toString();
    return `/unpaid${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Unpaid shifts" subtitle="Sorted by real pay date" />
      <Page>
        {cycle && (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <Link href={link({ period: period ? addDays(period.periodStart!, -periodLength) : today })} replace scroll={false}
                className="rounded-xl bg-slate-100 px-4 py-3 text-lg" aria-label="Previous pay period">‹</Link>
              <div className="text-center">
                <div className="num font-semibold">
                  {showAll ? "All pay periods" : `${fmtDate(period!.periodStart)} to ${fmtDate(period!.periodEnd)}`}
                </div>
                {!showAll && (
                  <div className="num text-xs text-slate-600">
                    Real pay date {fmtDayDate(period!.expectedPayDate)}
                    {period!.periodStart === currentPeriod?.periodStart ? " (this pay period)" : ""}
                  </div>
                )}
              </div>
              <Link href={link({ period: period ? addDays(period.periodStart!, periodLength) : today })} replace scroll={false}
                className="rounded-xl bg-slate-100 px-4 py-3 text-lg" aria-label="Next pay period">›</Link>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link href={link({ period: "" })} replace scroll={false}
                className={`rounded-xl border py-2 text-center text-sm font-semibold ${!showAll ? "border-ink bg-ink text-white" : "border-slate-300 bg-white"}`}>
                One pay period
              </Link>
              <Link href={link({ period: "all" })} replace scroll={false}
                className={`rounded-xl border py-2 text-center text-sm font-semibold ${showAll ? "border-ink bg-ink text-white" : "border-slate-300 bg-white"}`}>
                Everything unpaid
              </Link>
            </div>
          </Card>
        )}

        <Card>
          <div className="text-sm text-slate-600">
            {showAll || !period ? "Total unpaid" : "Unpaid this pay period"}{employer ? ` for ${employer}` : ""}
          </div>
          <div className="num text-3xl font-bold">{money(sum(unpaid, (s) => s.pay))}</div>
          <div className="num mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-red-50 p-2"><div>🔴 Overdue</div><div className="font-bold">{groups.overdue.length}</div><div className="text-xs">{money(sum(groups.overdue, (s) => s.pay))}</div></div>
            <div className="rounded-xl bg-yellow-50 p-2"><div>🟡 Due soon</div><div className="font-bold">{groups.soon.length}</div><div className="text-xs">{money(sum(groups.soon, (s) => s.pay))}</div></div>
            <div className="rounded-xl bg-slate-50 p-2"><div>⚪ Not due</div><div className="font-bold">{groups.waiting.length}</div><div className="text-xs">{money(sum(groups.waiting, (s) => s.pay))}</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={link({ employer: "" })} replace className={`rounded-full border px-3 py-2 text-sm font-semibold ${!employer ? "border-ink bg-ink text-white" : "border-slate-300 bg-white"}`}>All</Link>
            {names.map((n) => (
              <Link key={n.employer} href={link({ employer: n.employer })} replace
                className={`rounded-full border px-3 py-2 text-sm font-semibold ${employer === n.employer ? "border-ink bg-ink text-white" : "border-slate-300 bg-white"}`}>
                {n.employer}
              </Link>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={link({ view: "" })} replace className={`rounded-xl border py-3 text-center text-sm font-semibold ${grouped ? "border-ink bg-ink text-white" : "border-slate-300 bg-white"}`}>By pay date</Link>
            <Link href={link({ view: "list" })} replace className={`rounded-xl border py-3 text-center text-sm font-semibold ${!grouped ? "border-ink bg-ink text-white" : "border-slate-300 bg-white"}`}>Each shift</Link>
          </div>
          <Link href={link({ show: showPaid ? "" : "paid" })} replace className="mt-3 block text-sm text-ink underline">
            {showPaid ? "Hide paid shifts" : "Also show shifts paid in the last 90 days"}
          </Link>
          {!showAll && period && outsideCount > 0 && (
            <p className="num mt-3 text-xs text-slate-600">
              {plural(outsideCount, "unpaid shift")} in other pay periods, {money(allUnpaidTotal)} unpaid altogether.{" "}
              <Link href={link({ period: "all" })} replace className="font-semibold text-ink underline">See everything</Link>
            </p>
          )}
          {openCount > 0 && <p className="mt-2 text-xs text-slate-500">Only shifts marked Completed appear here. {openCount} past shift(s) are still Scheduled or Confirmed.</p>}
        </Card>

        <UnpaidList key={`${employer || "all"}|${grouped}|${showAll ? "all" : period?.periodStart}`} unpaid={unpaid} paid={paid} today={today} grouped={grouped} />
      </Page>
    </>
  );
}
