import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Returns the signed-in user's id or redirects to /login. */
export async function requireUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  return id;
}
