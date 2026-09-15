import { BottomNav } from "@/components/BottomNav";
import { isoToDb, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const overdueCount = await prisma.shift.count({
    where: { userId, status: "COMPLETED", paid: false, expectedPayDate: { lt: isoToDb(todayIso()) } },
  });
  return (
    <>
      {children}
      <BottomNav overdueCount={overdueCount} />
    </>
  );
}
