import { BottomNav } from "@/components/BottomNav";
import { IdleLogout } from "@/components/IdleLogout";
import { UserProvider } from "@/components/UserContext";
import { isoToDb, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { DEFAULT_IDLE_MINUTES } from "@/lib/session-rules";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const [user, overdueCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, avatarUpdatedAt: true, settings: { select: { idleTimeoutMinutes: true } } },
    }),
    prisma.shift.count({
      where: { userId, status: "COMPLETED", paid: false, expectedPayDate: { lt: isoToDb(todayIso()) } },
    }),
  ]);
  if (!user) return null;

  return (
    <UserProvider user={{ name: user.name, email: user.email, avatarVersion: user.avatarUpdatedAt?.getTime() ?? null }}>
      {children}
      <BottomNav overdueCount={overdueCount} />
      <IdleLogout minutes={user.settings?.idleTimeoutMinutes ?? DEFAULT_IDLE_MINUTES} />
    </UserProvider>
  );
}
