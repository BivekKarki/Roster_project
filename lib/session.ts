import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { syncShiftStatuses } from "./shiftStatusSync";


/**
 * Returns the signed-in user's id or redirects to /login.
 *
 * Pages don't update shift statuses here: screens work the finished/not-finished state out from
 * the clock as they render, and the database catch-up runs in `requireUserIdForWrite` (used by
 * every server action) where cache invalidation is allowed.
 */
export async function requireUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  return id;
}

/** Same, but also saves any shift that has finished since the last write. Use this in actions. */
export async function requireUserIdForWrite() {
  const id = await requireUserId();
  await syncShiftStatuses(id);
  return id;
}
