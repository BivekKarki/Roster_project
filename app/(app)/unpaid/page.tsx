import type { Metadata } from "next";
import Link from "next/link";
import { UnpaidList } from "@/components/UnpaidList";
import { Card, Page, PageHeader } from "@/components/ui";
import { sum } from "@/lib/calc";
import { findShifts, getSettings } from "@/lib/data";
import { addDays, isoToDb, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";
import { one, type SearchParams } from "@/lib/params";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Unpaid" };

export default async function UnpaidPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const employer = one(sp.employer);
  const showPaid = one(sp.show) === "paid";
  const settings = await getSettings(userId);
  const today = todayIso();

  const [unpaidRaw, paid, names, openCount] = await Promise.all([
    findShifts(userId, { status: "COMPLETED", paid: false, ...(employer ? { employer } : {}) }, settings),
    showPaid
      ? findShifts(userId, { status: "COMPLETED", paid: true, actualPayDate: { gte: isoToDb(addDays(today, -90)) }, ...(employer ? { employer } : {}) }, settings, { orderBy: [{ actualPayDate: "desc" }] })
      : Promise.resolve([]),
    prisma.shift.findMany({ where: { userId, status: "COMPLETED" }, select: { employer: true }, distinct: ["employer"], orderBy: { employer: "asc" } }),
    prisma.shift.count({ where: { userId, status: { in: ["SCHEDULED", "CONFIRMED"] }, date: { lt: isoToDb(today) } } }),
  ]);

  const unpaid = [...unpaidRaw].sort((a, b) =>
    (a.expectedPayDate ?? "9999").localeCompare(b.expectedPayDate ?? "9999") || a.date.localeCompare(b.date));
  const groups = {
    overdue: unpaid.filter((s) => s.payState === "overdue"),
    soon: unpaid.filter((s) => s.payState === "soon"),
    waiting: unpaid.filter((s) => s.payState === "waiting"),
  };
  const link = (params: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries({ employer, show: showPaid ? "paid" : "", ...params }).filter(([, v]) => v)).toString();
    return `/unpaid${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Unpaid shifts" subtitle="Sorted by expected payment date" />
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
          <Link href={link({ show: showPaid ? "" : "paid" })} replace className="mt-3 block text-sm text-ink underline">
            {showPaid ? "Hide paid shifts" : "Also show shifts paid in the last 90 days"}
          </Link>
          {openCount > 0 && <p className="mt-2 text-xs text-slate-500">Only shifts marked Completed appear here. {openCount} past shift(s) are still Scheduled or Confirmed.</p>}
        </Card>

        <UnpaidList key={employer || "all"} unpaid={unpaid} paid={paid} today={today} />
      </Page>
    </>
  );
}
