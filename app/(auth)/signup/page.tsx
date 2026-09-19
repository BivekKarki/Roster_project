import type { Metadata } from "next";
import { SignupForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; name?: string; email?: string; sample?: string }> }) {
  const sp = await searchParams;
  return (
    <SignupForm
      allowed={process.env.ALLOW_SIGNUP !== "false"}
      error={sp.error}
      name={sp.name}
      email={sp.email}
      sample={sp.error ? sp.sample === "1" : true}
    />
  );
}
