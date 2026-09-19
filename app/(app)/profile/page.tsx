import type { Metadata } from "next";
import { logout } from "@/app/actions/auth";
import { AutoLogoutForm, AvatarUploader, NameForm } from "@/components/ProfileForms";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Page, PageHeader } from "@/components/ui";
import { getAccount } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { DEFAULT_IDLE_MINUTES, sessionMaxDays } from "@/lib/session-rules";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const userId = await requireUserId();
  const user = await getAccount(userId);
  if (!user) return null;
  const version = user.avatarUpdatedAt?.getTime() ?? null;

  return (
    <>
      <PageHeader title="Profile" subtitle={user.email} />
      <Page>
        <Card>
          <h2 className="mb-3 font-bold">Photo</h2>
          <AvatarUploader name={user.name} email={user.email} version={version} />
        </Card>
        <Card>
          <NameForm name={user.name} />
          <p className="mt-3 text-xs text-slate-500">
            Email {user.email}{user.emailVerifiedAt ? ` (confirmed ${fmtDate(user.emailVerifiedAt.toISOString().slice(0, 10))})` : ""}.
            {" "}Member since {fmtDate(user.createdAt.toISOString().slice(0, 10))}.
          </p>
        </Card>
        <Card>
          <h2 className="font-bold">Auto logout</h2>
          <p className="mb-3 text-sm text-slate-600">Log out automatically when there&apos;s been no activity for:</p>
          <AutoLogoutForm minutes={user.settings?.idleTimeoutMinutes ?? DEFAULT_IDLE_MINUTES} />
          <p className="mt-2 text-xs text-slate-500">Maximum session length: {sessionMaxDays()} days.</p>
        </Card>
        <form action={logout}>
          <SubmitButton variant="ghost" pendingText="Logging out…" className="w-full">Log out</SubmitButton>
        </form>
      </Page>
    </>
  );
}
