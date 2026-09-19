import { BottomNav } from "@/components/BottomNav";
import { IdleLogout } from "@/components/IdleLogout";
import { UserProvider } from "@/components/UserContext";
import { getAccount, getSettings } from "@/lib/data";
import { requireUserId } from "@/lib/session";
import { appTimeZone } from "@/lib/shift-time";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  // One query: name, photo, settings and the overdue badge count.
  const user = await getAccount(userId);
  if (!user) return null;
  const settings = await getSettings(userId); // from the same cached query
  const overdueCount = user._count.shifts;

  return (
    <UserProvider user={{
      name: user.name, email: user.email, avatarVersion: user.avatarUpdatedAt?.getTime() ?? null,
      timeZone: appTimeZone(), autoCompleteShifts: settings.autoCompleteShifts,
    }}>
      {children}
      <BottomNav overdueCount={overdueCount} />
      <IdleLogout minutes={settings.idleTimeoutMinutes} />
    </UserProvider>
  );
}
