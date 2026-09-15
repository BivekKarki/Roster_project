import type { Metadata } from "next";
import Link from "next/link";
import { ShiftForm } from "@/components/ShiftForm";
import { Page, PageHeader } from "@/components/ui";
import { getSettings, getSites } from "@/lib/data";
import { isIsoDate, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { toShiftDTO } from "@/lib/mappers";
import { one, type SearchParams } from "@/lib/params";
import { requireUserId } from "@/lib/session";
import { siteUsage } from "@/lib/usage";

export const metadata: Metadata = { title: "Add shift" };

const safeReturn = (v: string) => (v.startsWith("/") && !v.startsWith("//") ? v : "/roster");

export default async function NewShiftPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const today = todayIso();
  const fromId = one(sp.from);
  const returnTo = safeReturn(one(sp.returnTo));

  const [sites, settings, usage, templateRow] = await Promise.all([
    getSites(userId),
    getSettings(userId),
    siteUsage(userId),
    fromId ? prisma.shift.findFirst({ where: { id: fromId, userId } }) : Promise.resolve(null),
  ]);
  const template = templateRow ? toShiftDTO(templateRow) : null;
  const date = isIsoDate(one(sp.date)) ? one(sp.date) : template?.date ?? today;

  return (
    <>
      <PageHeader title={template ? "Duplicate shift" : "Add shift"} action={<Link href={returnTo} className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">Cancel</Link>} />
      <Page>
        <ShiftForm sites={sites} settings={settings} initial={null} template={template} date={date} today={today} returnTo={returnTo} usage={usage} />
      </Page>
    </>
  );
}
