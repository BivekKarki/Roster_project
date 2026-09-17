import { BottomNav } from "@/components/BottomNav";
import { IdleLogout } from "@/components/IdleLogout";
import { UserProvider } from "@/components/UserContext";
import { isoToDb, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { DEFAULT_IDLE_MINUTES } from "@/lib/session-rules";
import { requireUserId } from "@/lib/session";
import { appTimeZone } from "@/lib/shift-time";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const [user, overdueCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, avatarUpdatedAt: true, settings: { select: { idleTimeoutMinutes: true, autoCompleteShifts: true } } },
    }),
    prisma.shift.count({
      where: { userId, status: "COMPLETED", paid: false, expectedPayDate: { lt: isoToDb(todayIso()) } },
    }),
  ]);
  if (!user) return null;

  return (
    <UserProvider user={{
      name: user.name, email: user.email, avatarVersion: user.avatarUpdatedAt?.getTime() ?? null,
      timeZone: appTimeZone(), autoCompleteShifts: user.settings?.autoCompleteShifts ?? true,
    }}>
      {children}
      <BottomNav overdueCount={overdueCount} />
      <IdleLogout minutes={user.settings?.idleTimeoutMinutes ?? DEFAULT_IDLE_MINUTES} />
    </UserProvider>
  );
}
