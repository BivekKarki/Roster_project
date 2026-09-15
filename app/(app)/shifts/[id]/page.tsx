import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteShift } from "@/app/actions/shifts";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { ShiftForm } from "@/components/ShiftForm";
import { btn, Page, PageHeader } from "@/components/ui";
import { getSettings, getSites } from "@/lib/data";
import { dayName, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { toShiftDTO } from "@/lib/mappers";
import { one, type SearchParams } from "@/lib/params";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Edit shift" };

const safeReturn = (v: string) => (v.startsWith("/") && !v.startsWith("//") ? v : "/roster");

export default async function EditShiftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const userId = await requireUserId();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const returnTo = safeReturn(one(sp.returnTo));

  const [row, sites, settings] = await Promise.all([
    prisma.shift.findFirst({ where: { id, userId } }),
    getSites(userId),
    getSettings(userId),
  ]);
  if (!row) notFound();
  const shift = toShiftDTO(row);

  return (
    <>
      <PageHeader title="Edit shift" subtitle={`${dayName(shift.date)} ${fmtDate(shift.date)}`}
        action={<Link href={returnTo} className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">Close</Link>} />
      <Page>
        <ShiftForm sites={sites} settings={settings} initial={shift} template={null} date={shift.date} today={todayIso()} returnTo={returnTo} usage={{}} />
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/shifts/new?from=${shift.id}&returnTo=${encodeURIComponent(returnTo)}`} className={btn.ghost}>Duplicate</Link>
          <form action={deleteShift}>
            <input type="hidden" name="id" value={shift.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <ConfirmSubmit label="Delete" confirmLabel="Tap to delete" className="w-full" />
          </form>
        </div>
      </Page>
    </>
  );
}
