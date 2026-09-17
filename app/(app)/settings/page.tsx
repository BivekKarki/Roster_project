import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { PayCycleForm } from "@/components/PayCycleForm";
import { GeneralSettingsForm, ImportForm } from "@/components/SettingsForms";
import { SubmitButton } from "@/components/SubmitButton";
import { btn, Card, Page, PageHeader } from "@/components/ui";
import { auth } from "@/auth";
import { getSettings, getSites } from "@/lib/data";
import { todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { employersWithoutPayCycle, suggestedPayCycle } from "@/lib/payCycleDefaults";
import { fmtDate, fmtTime, money } from "@/lib/format";
import { requireUserId } from "@/lib/session";
import { FREQUENCY_LABEL, WEEKDAYS } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [sites, settings, session, cycle, noCycle, unpaidCount] = await Promise.all([
    getSites(userId), getSettings(userId), auth(), suggestedPayCycle(userId), employersWithoutPayCycle(userId),
    prisma.shift.count({ where: { userId, paid: false, status: { not: "CANCELLED" } } }),
  ]);

  return (
    <>
      <PageHeader title="Settings" subtitle={session?.user?.email ?? undefined} />
      <Page>
        <Link href="/profile" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
          <span>
            <span className="block font-bold">Profile and auto logout</span>
            <span className="block text-sm text-slate-600">Photo, name and how long before you&apos;re logged out</span>
          </span>
          <span aria-hidden className="text-xl text-slate-400">›</span>
        </Link>
        <Card>
          <h2 className="mb-2 font-bold">Employers and locations</h2>
          <div className="space-y-2">
            {sites.length === 0 && <p className="text-sm text-slate-500">No employers yet. Add one to start entering shifts.</p>}
            {sites.map((s) => (
              <Link key={s.id} href={`/settings/sites/${s.id}`} className="block rounded-xl border border-slate-200 bg-white p-3 active:bg-slate-50">
                <div className="font-semibold">{s.employer}, {s.location}</div>
                <div className="num text-sm text-slate-600">
                  {s.defaultStart && s.defaultEnd ? `${fmtTime(s.defaultStart)}–${fmtTime(s.defaultEnd)}` : "No default times"}
                  {", "}
                  {s.defaultRate === null ? <span className="font-semibold text-orange-700">rate not set</span> : `${money(s.defaultRate)}/h`}
                </div>
                <div className="text-xs text-slate-500">
                  {s.payPeriodStart && s.payWeekday !== null
                    ? `${s.payPeriodDays === 7 ? "Weekly" : "Fortnightly"} from ${fmtDate(s.payPeriodStart)}, supposed pay ${WEEKDAYS[s.payWeekday]} after${s.payLateDays ? `, real pay ${s.payLateDays} days later` : ""}`
                    : `${FREQUENCY_LABEL[s.payFrequency]}, paid about ${s.payDelayDays} days after each shift`}
                </div>
              </Link>
            ))}
          </div>
          <Link href="/settings/sites/new" className={`${btn.primary} mt-3 w-full`}>+ Add employer or location</Link>
        </Card>

        {sites.length > 0 && (
          <section id="pay-cycle" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold">Pay cycle for all employers</h2>
            <p className="mb-3 text-sm text-slate-600">
              Every shift in a pay period gets the same supposed pay date, and a real pay date that allows for payroll being late.
            </p>
            {noCycle.length > 0 && (
              <div className="mb-3 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm">
                <b>{noCycle.map((s) => `${s.employer}, ${s.location}`).join("; ")}</b>{" "}
                {noCycle.length === 1 ? "has" : "have"} no pay cycle yet, so pay dates are just the shift date plus {noCycle[0].payDelayDays} days.
              </div>
            )}
            <PayCycleForm
              initial={{ payPeriodStart: cycle.payPeriodStart, payPeriodDays: cycle.payPeriodDays, payWeekday: cycle.payWeekday, payLateDays: cycle.payLateDays }}
              today={todayIso()}
              employerCount={sites.length}
              unpaidCount={unpaidCount}
            />
          </section>
        )}

        <GeneralSettingsForm settings={settings} />

        <Card>
          <h2 className="font-bold">Export and backup</h2>
          <p className="mb-3 text-xs text-slate-500">Everything is stored in your database. Download a backup now and then so you also have your own copy.</p>
          <div className="grid grid-cols-3 gap-2">
            <a href="/api/export/csv" className={`${btn.ghost} px-2 text-sm`}>CSV</a>
            <a href="/api/export/xlsx" className={`${btn.ghost} px-2 text-sm`}>Excel</a>
            <a href="/api/export/json" className={`${btn.ghost} px-2 text-sm`}>Backup</a>
          </div>
          <ImportForm />
        </Card>

        <form action={logout}>
          <SubmitButton variant="ghost" pendingText="Logging out…" className="w-full">Log out</SubmitButton>
        </form>
      </Page>
    </>
  );
}
