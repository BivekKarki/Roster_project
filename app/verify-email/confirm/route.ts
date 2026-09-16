import { NextResponse, type NextRequest } from "next/server";
import { signIn } from "@/auth";
import { createLoginTicket, verifyLinkToken } from "@/lib/verification";

export const dynamic = "force-dynamic";

/** The link in the verification email. Confirms the email and signs the user in. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = await verifyLinkToken(token);

  if (result.ok) {
    const ticket = await createLoginTicket(result.userId);
    await signIn("ticket", { ticket, redirectTo: "/?verified=1" }); // throws a redirect
  }

  const target = new URL("/verify-email", request.nextUrl.origin);
  if (!result.ok && result.error === "already-verified") return NextResponse.redirect(new URL("/login?verified=1", request.nextUrl.origin));
  target.searchParams.set("error", !result.ok && result.error === "expired" ? "expired" : "invalid");
  return NextResponse.redirect(target);
}
