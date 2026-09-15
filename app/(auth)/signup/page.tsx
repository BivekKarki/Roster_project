import type { Metadata } from "next";
import { SignupForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <SignupForm allowed={process.env.ALLOW_SIGNUP !== "false"} />;
}
