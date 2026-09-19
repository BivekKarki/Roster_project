import type { Metadata } from "next";
import Link from "next/link";
import { UnpaidList } from "@/components/UnpaidList";
import { Card, Page, PageHeader } from "@/components/ui";
import { sum } from "@/lib/calc";
import { findShifts, getOpenPastShifts, getSettings, getUnpaidShifts } from "@/lib/data";
import { addDays, isoToDb, todayIso } from "@/lib/dates";
import { money } from "@/lib/format";
import { one, type SearchParams } from "@/lib/params";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Unpaid" };

export default async function UnpaidPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const employer = one(sp.employer);
  const showPaid = one(sp.show) === "paid";
  const grouped = one(sp.view) !== "list";
  const settings = await getSettings(userId);
  const today = todayIso();

  const [allUnpaid, paid, openPast] = await Promise.all([
    getUnpaidShifts(userId), // cached: the layout already loaded this for the nav badge
    showPaid
      ? findShifts(userId, { status: "COMPLETED", paid: true, actualPayDate: { gte: isoToDb(addDays(today, -90)) }, ...(employer ? { employer } : {}) }, settings, { orderBy: [{ actualPayDate: "desc" }] })
      : Promise.resolve([]),
    getOpenPastShifts(userId), // cached
  ]);
  const names = [...new Set(allUnpaid.map((s) => s.employer))].sort().map((e) => ({ employer: e }));
  const openCount = openPast.filter((s) => s.phase === "finished").length;
  const unpaidRaw = employer ? allUnpaid.filter((s) => s.employer === employer) : allUnpaid;

  const unpaid = [...unpaidRaw].sort((a, b) =>
    (a.expectedPayDate ?? "9999").localeCompare(b.expectedPayDate ?? "9999") || a.date.localeCompare(b.date));
  const groups = {
    overdue: unpaid.filter((s) => s.payState === "overdue"),
    soon: unpaid.filter((s) => s.payState === "soon"),
    waiting: unpaid.filter((s) => s.payState === "waiting"),
  };
  const link = (params: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries({ employer, show: showPaid ? "paid" : "", view: grouped ? "" : "list", ...params }).filter(([, v]) => v)).toString();
    return `/unpaid${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Unpaid shifts" subtitle="Sorted by real pay date" />
      <Page>
        <Card>
          <div className="text-sm text-slate-600">Total unpaid{employer ? ` for ${employer}` : ""}</div>
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
          {openCount > 0 && <p className="mt-2 text-xs text-slate-500">Only shifts marked Completed appear here. {openCount} past shift(s) are still Scheduled or Confirmed.</p>}
        </Card>

        <UnpaidList key={`${employer || "all"}|${grouped}`} unpaid={unpaid} paid={paid} today={today} grouped={grouped} />
      </Page>
    </>
  );
}
