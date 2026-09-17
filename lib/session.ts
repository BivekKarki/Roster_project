import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { syncShiftStatuses } from "./shiftStatusSync";

/**
 * Returns the signed-in user's id or redirects to /login.
 * Also brings shift statuses up to date (finished shifts become Completed) before anything is read.
 */
export async function requireUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  await syncShiftStatuses(id);
  return id;
}
