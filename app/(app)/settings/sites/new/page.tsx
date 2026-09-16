import type { Metadata } from "next";
import Link from "next/link";
import { SiteForm } from "@/components/SiteForm";
import { Page, PageHeader } from "@/components/ui";
import { getSettings, getSites } from "@/lib/data";
import { todayIso } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { siteShiftCounts } from "@/lib/siteCounts";

export const metadata: Metadata = { title: "Add employer" };

export default async function NewSitePage() {
  const userId = await requireUserId();
  const [sites, settings, counts] = await Promise.all([getSites(userId), getSettings(userId), siteShiftCounts(userId)]);
  return (
    <>
      <PageHeader title="Add employer" action={<Link href="/settings" className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">Cancel</Link>} />
      <Page>
        <SiteForm site={null} employers={[...new Set(sites.map((s) => s.employer))]} defaultDelay={settings.payDelayDays} today={todayIso()} {...counts} />
      </Page>
    </>
  );
}
