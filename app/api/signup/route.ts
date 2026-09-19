import { NextResponse, type NextRequest } from "next/server";
import { signup } from "@/app/actions/auth";

/** Same idea as /api/login: a real form post, so the browser offers to save the new password. */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const result = await signup(undefined, formData); // throws a redirect when it succeeds

  const url = new URL("/signup", request.nextUrl.origin);
  url.searchParams.set("error", result?.error ?? "Something went wrong. Try again.");
  for (const field of ["name", "email"]) {
    const value = formData.get(field);
    if (typeof value === "string" && value) url.searchParams.set(field, value.slice(0, 120));
  }
  if (formData.get("sample") === "on") url.searchParams.set("sample", "1");
  return NextResponse.redirect(url, { status: 303 });
}
