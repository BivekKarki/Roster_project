import type { Metadata } from "next";
import Link from "next/link";
import { MonthCalendar } from "@/components/MonthCalendar";
import { ShiftRow } from "@/components/ShiftRow";
import { btn, Card, Page, PageHeader, SegmentedLinks } from "@/components/ui";
import { defaultSelectedDay, employerColours, isMonthKey, monthGrid, monthLabel, monthOf } from "@/lib/calendar";
import { sum } from "@/lib/calc";
import { getSettings, getShiftsBetween, getSites } from "@/lib/data";
import { addDays, dayName, diffDays, isIsoDate, mondayOf, todayIso } from "@/lib/dates";
import { fmtDate, fmtHours, money, plural } from "@/lib/format";
import { intParam, one, type SearchParams } from "@/lib/params";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Roster" };

export default async function RosterPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Old week links (?week= / ?date=) still open the week view.
  const weekView = one(sp.view) === "week" || !!one(sp.week) || !!one(sp.date);
  return weekView ? <WeekView sp={sp} /> : <MonthView sp={sp} />;
}

const VIEW_TABS = (active: "month" | "week") => (
  <SegmentedLinks value={active} options={[
    { value: "month", label: "Month", href: "/roster" },
    { value: "week", label: "Week", href: "/roster?view=week" },
  ]} />
);

async function MonthView({ sp }: { sp: Awaited<SearchParams> }) {
  const userId = await requireUserId();
  const today = todayIso();
  const month = isMonthKey(one(sp.month)) ? one(sp.month) : monthOf(today);
  const grid = monthGrid(month);
  const settings = await getSettings(userId);

  const [shifts, sites] = await Promise.all([
    getShiftsBetween(userId, grid.start, grid.end), // cached until you change something
    getSites(userId),
  ]);
  // Colours come from your saved employers (plus any that only exist on old shifts),
  // so they stay the same from month to month.
  const colours = employerColours([...sites.map((s) => s.employer), ...shifts.map((s) => s.employer)]);

  return (
    <>
      <PageHeader title="Roster" subtitle={monthLabel(month)} />
      <Page>
        {VIEW_TABS("month")}
        <MonthCalendar
          key={month}
          month={month}
          today={today}
          initialDay={defaultSelectedDay(month, today, one(sp.day))}
          shifts={shifts}
          colours={colours}
        />
      </Page>
    </>
  );
}

async function WeekView({ sp }: { sp: Awaited<SearchParams> }) {
  const userId = await requireUserId();
  const today = todayIso();
  const jump = one(sp.date);
  const offset = isIsoDate(jump)
    ? Math.round(diffDays(mondayOf(jump), mondayOf(today)) / 7)
    : intParam(sp.week);

  const start = addDays(mondayOf(today), 7 * offset);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const settings = await getSettings(userId);
  const shifts = await getShiftsBetween(userId, start, end);
  const active = shifts.filter((s) => s.status !== "CANCELLED");
  const here = `/roster?view=week&week=${offset}`;

  return (
    <>
      <PageHeader title="Roster" subtitle={`Week of ${fmtDate(start)}`} />
      <Page>
        {VIEW_TABS("week")}
        <Card>
          <div className="flex items-center justify-between">
            <Link href={`/roster?view=week&week=${offset - 1}`} replace scroll={false} className="rounded-xl bg-slate-100 px-4 py-3 text-lg" aria-label="Previous week">‹</Link>
            <div className="text-center">
              <div className="num font-semibold">{fmtDate(start)} to {fmtDate(end)}</div>
              <div className="num text-sm text-slate-600">{fmtHours(sum(active, (s) => s.hours))} across {plural(active.length, "shift")}, {money(sum(active, (s) => s.pay))}</div>
            </div>
            <Link href={`/roster?view=week&week=${offset + 1}`} replace scroll={false} className="rounded-xl bg-slate-100 px-4 py-3 text-lg" aria-label="Next week">›</Link>
          </div>
          <form action="/roster" className="mt-3 flex gap-2">
            <input type="hidden" name="view" value="week" />
            <input type="date" name="date" aria-label="Jump to date" className="input" />
            <button type="submit" className={btn.ghost}>Go</button>
            {offset !== 0 && <Link href="/roster?view=week" className={btn.ghost}>Today</Link>}
          </form>
        </Card>

        {days.map((d) => {
          const list = shifts.filter((s) => s.date === d);
          const total = sum(list.filter((s) => s.status !== "CANCELLED"), (s) => s.hours);
          const isToday = d === today;
          return (
            <section key={d} className={`overflow-hidden rounded-2xl bg-white ${isToday ? "border-2 border-ink" : "border border-slate-200"}`}>
              <div className={`flex items-center justify-between px-3 py-2 ${isToday ? "bg-ink text-white" : "bg-slate-100"}`}>
                <h2 className="num font-bold">{dayName(d).toUpperCase()} {fmtDate(d)}{isToday ? " (today)" : ""}</h2>
                <span className="num text-sm font-semibold">{total > 0 ? fmtHours(total) : "Free"}</span>
              </div>
              <div className="space-y-2 p-2">
                {list.map((s) => <ShiftRow key={s.id} s={s} returnTo={here} />)}
                <Link href={`/shifts/new?date=${d}&returnTo=${encodeURIComponent(here)}`}
                  className="block rounded-xl border border-dashed border-slate-300 py-2 text-center text-sm text-slate-500">
                  + Add shift on {dayName(d)}
                </Link>
              </div>
            </section>
          );
        })}
      </Page>
    </>
  );
}
