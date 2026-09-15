import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSite } from "@/app/actions/sites";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { SiteForm } from "@/components/SiteForm";
import { Page, PageHeader } from "@/components/ui";
import { getSettings, getSites } from "@/lib/data";
import { plural } from "@/lib/format";
import { requireUserId } from "@/lib/session";
import { siteShiftCounts } from "@/lib/siteCounts";

export const metadata: Metadata = { title: "Edit employer" };

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const [sites, settings, counts] = await Promise.all([getSites(userId), getSettings(userId), siteShiftCounts(userId)]);
  const site = sites.find((s) => s.id === id);
  if (!site) notFound();
  const shiftCount = counts.shiftCounts[`${site.employer}|${site.location}`] ?? 0;

  return (
    <>
      <PageHeader title="Edit employer" subtitle={`${site.employer}, ${site.location}`}
        action={<Link href="/settings" className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">Cancel</Link>} />
      <Page>
        <SiteForm site={site} employers={[...new Set(sites.map((s) => s.employer))]} defaultDelay={settings.payDelayDays} {...counts} />
        <form action={deleteSite} className="space-y-1">
          <input type="hidden" name="id" value={site.id} />
          <ConfirmSubmit label="Remove this employer" confirmLabel="Tap again to remove" className="w-full" />
          {shiftCount > 0 && <p className="text-center text-xs text-slate-500">Your {plural(shiftCount, "shift")} here will be kept.</p>}
        </form>
      </Page>
    </>
  );
}
