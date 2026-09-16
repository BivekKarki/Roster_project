import Link from "next/link";
import { markCompleted } from "@/app/actions/shifts";
import { ShiftRow } from "@/components/ShiftRow";
import { SubmitButton } from "@/components/SubmitButton";
import { btn, Card, Page, PageHeader, SegmentedLinks, Stat } from "@/components/ui";
import { periodRange, sum, summarize, summarizeByEmployer } from "@/lib/calc";
import { dateRange, findShifts, getSettings } from "@/lib/data";
import { dayName, isoToDb, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { fmtDate, fmtHours, fmtTime, money, plural } from "@/lib/format";
import { intParam, one, type SearchParams } from "@/lib/params";
import { requireUserId } from "@/lib/session";
import type { PeriodKind } from "@/lib/types";

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "fortnight", label: "Fortnight" },
  { value: "month", label: "Month" },
  { value: "fy", label: "FY" },
];

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const kind = (KINDS.some((k) => k.value === one(sp.period)) ? one(sp.period) : "fortnight") as PeriodKind;
  const offset = intParam(sp.offset);
  const today = todayIso();
  const settings = await getSettings(userId);
  const period = periodRange(kind, offset, settings, today);

  const [inRange, pastOpen, unpaid, noRateCount, todays, siteCount, user] = await Promise.all([
    findShifts(userId, { date: dateRange(period.start, period.end) }, settings),
    findShifts(userId, { date: { lt: isoToDb(today) }, status: { in: ["SCHEDULED", "CONFIRMED"] } }, settings),
    findShifts(userId, { status: "COMPLETED", paid: false }, settings),
    prisma.shift.count({ where: { userId, rate: null, status: { not: "CANCELLED" } } }),
    findShifts(userId, { date: isoToDb(today), status: { not: "CANCELLED" } }, settings),
    prisma.site.count({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  const st = summarize(inRange);
  const employers = summarizeByEmployer(inRange);
  const overdue = unpaid.filter((s) => s.payState === "overdue");
  const soon = unpaid.filter((s) => s.payState === "soon");
  const href = (k: string, o: number) => `/?period=${k}&offset=${o}`;

  return (
    <>
      <PageHeader title={user?.name ? `Hi ${user.name}` : "Dashboard"} subtitle={`${dayName(today)} ${fmtDate(today)}`} />
      <Page>
        {one(sp.verified) && (
          <Card className="border-green-300 bg-green-50">
            <h2 className="font-bold">Email confirmed 🎉</h2>
            <p className="text-sm text-slate-700">Welcome to ShiftBook. Your account is ready.</p>
          </Card>
        )}
        {siteCount === 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <h2 className="font-bold">Add your first employer</h2>
            <p className="mb-3 text-sm text-slate-700">Save each employer and location with its usual times and rate. New shifts fill in from these.</p>
            <Link href="/settings/sites/new" className={`${btn.primary} w-full`}>Add employer</Link>
          </Card>
        )}

        {pastOpen.length > 0 && (
          <Card className="border-yellow-300 bg-yellow-50">
            <h2 className="font-bold">Did you work these?</h2>
            <p className="mb-2 text-sm text-slate-700">
              {plural(pastOpen.length, "past shift")} still marked Scheduled or Confirmed. Mark them Completed to track payment.
            </p>
            <div className="space-y-2">
              {pastOpen.slice(0, 6).map((s) => (
                <form key={s.id} action={markCompleted} className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-white p-2">
                  <input type="hidden" name="ids" value={s.id} />
                  <Link href={`/shifts/${s.id}?returnTo=/`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.employer}, {s.location}</div>
                    <div className="num text-xs text-slate-600">{s.day.slice(0, 3)} {fmtDate(s.date)}, {fmtTime(s.startTime)}–{fmtTime(s.endTime)}</div>
                  </Link>
                  <SubmitButton variant="go" pendingText="…" className="px-3 py-2 text-sm">Completed</SubmitButton>
                </form>
              ))}
            </div>
            {pastOpen.length > 1 && (
              <form action={markCompleted} className="mt-2">
                {pastOpen.map((s) => <input key={s.id} type="hidden" name="ids" value={s.id} />)}
                <SubmitButton variant="go" pendingText="Updating…" className="w-full">Mark all {pastOpen.length} as Completed</SubmitButton>
              </form>
            )}
          </Card>
        )}

        {(overdue.length > 0 || soon.length > 0) && (
          <Link href="/unpaid" className="block rounded-2xl border border-red-300 bg-red-50 p-4">
            <h2 className="font-bold">Payments to check</h2>
            <div className="mt-1 text-sm">
              {overdue.length > 0 && <span className="mr-3">🔴 {overdue.length} overdue</span>}
              {soon.length > 0 && <span>🟡 {soon.length} due soon</span>}
            </div>
            <div className="num mt-1 text-sm text-slate-700">Total unpaid: <b>{money(sum(unpaid, (s) => s.pay))}</b>. Tap to open Unpaid.</div>
          </Link>
        )}

        {noRateCount > 0 && (
          <Card className="border-orange-300 bg-orange-50">
            <h2 className="font-bold">{plural(noRateCount, "shift has", "shifts have")} no hourly rate</h2>
            <p className="text-sm text-slate-700">Pay can&apos;t be calculated yet. Set a default rate on the employer in Settings and tick the option to fill it into these shifts.</p>
            <Link href="/settings" className={`${btn.ghost} mt-2 w-full`}>Open Settings</Link>
          </Card>
        )}

        <Card>
          <SegmentedLinks value={kind} options={KINDS.map((k) => ({ ...k, href: href(k.value, 0) }))} />
          <div className="mt-3 flex items-center justify-between">
            <Link href={href(kind, offset - 1)} replace scroll={false} className="rounded-xl bg-slate-100 px-4 py-3 text-lg" aria-label="Previous period">‹</Link>
            <div className="text-center">
              <div className="num font-semibold">{period.label}</div>
              {offset !== 0 && <Link href={href(kind, 0)} replace scroll={false} className="text-xs text-slate-600 underline">Back to current</Link>}
            </div>
            <Link href={href(kind, offset + 1)} replace scroll={false} className="rounded-xl bg-slate-100 px-4 py-3 text-lg" aria-label="Next period">›</Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Total shifts" value={st.shifts} />
            <Stat label="Total hours" value={fmtHours(st.hours)} />
            <Stat label="Expected pay" value={money(st.expected)} className="bg-blue-50" />
            <Stat label="Amount paid" value={money(st.paid)} className="bg-green-50" />
            <Stat label="Still unpaid (worked)" value={money(st.unpaidAmount)} className="bg-red-50" />
            <Stat label="Unpaid shifts" value={st.unpaidCount} className="bg-red-50" />
            <Stat label="Completed shifts" value={st.completedCount} />
            <Stat label="Not yet worked" value={money(st.upcoming)} />
          </div>
          {st.missingRate > 0 && <p className="mt-2 text-xs text-orange-700">{plural(st.missingRate, "shift")} in this period {st.missingRate === 1 ? "has" : "have"} no rate, so totals are incomplete.</p>}
        </Card>

        <Card>
          <h2 className="font-bold">Income by employer</h2>
          <p className="mb-2 text-xs text-slate-500">Shifts in {period.label}. Outstanding means completed but not yet paid.</p>
          {employers.length === 0 && <p className="py-2 text-sm text-slate-500">No shifts in this period. Tap Add shift to enter one.</p>}
          {employers.map((e, i) => (
            <div key={e.name} className={`py-3 ${i > 0 ? "border-t border-slate-200" : ""}`}>
              <div className="flex justify-between font-semibold"><span>{e.name}</span><span className="num">{fmtHours(e.hours)}</span></div>
              <div className="num mt-1 grid grid-cols-3 gap-1 text-sm">
                <div><div className="text-xs text-slate-500">Expected</div>{money(e.expected)}</div>
                <div><div className="text-xs text-slate-500">Paid</div><span className="text-green-700">{money(e.paid)}</span></div>
                <div><div className="text-xs text-slate-500">Outstanding</div><span className={e.unpaidAmount > 0 ? "font-semibold text-red-700" : ""}>{money(e.unpaidAmount)}</span></div>
              </div>
              {e.upcoming > 0 && <p className="mt-1 text-xs text-slate-500">Expected includes {money(e.upcoming)} from shifts not yet worked.</p>}
              {e.missingRate > 0 && <p className="mt-1 text-xs text-orange-700">{plural(e.missingRate, "shift")} missing a rate.</p>}
            </div>
          ))}
        </Card>

        <Card>
          <h2 className="mb-2 font-bold">Today</h2>
          {todays.length === 0
            ? <p className="text-sm text-slate-500">No shifts today.</p>
            : <div className="space-y-2">{todays.map((s) => <ShiftRow key={s.id} s={s} returnTo="/" />)}</div>}
        </Card>
      </Page>
    </>
  );
}
