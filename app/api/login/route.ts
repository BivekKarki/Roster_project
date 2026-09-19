import { NextResponse, type NextRequest } from "next/server";
import { login } from "@/app/actions/auth";

/**
 * The login form posts here as a normal HTML form, so signing in is a real page navigation.
 * That's what makes Chrome, Safari and password managers offer to save the password
 * (a server action submitted over fetch doesn't trigger that prompt).
 * On success `login` redirects; on failure we come back to /login with the message.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const result = await login(undefined, formData); // throws a redirect when it succeeds

  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("error", result?.error ?? "Something went wrong. Try again.");
  const email = formData.get("email");
  if (typeof email === "string" && email) url.searchParams.set("email", email.slice(0, 120));
  return NextResponse.redirect(url, { status: 303 });
}
