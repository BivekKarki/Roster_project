import type { Metadata } from "next";
import Link from "next/link";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";
import { Alert, btn } from "@/components/ui";

export const metadata: Metadata = { title: "Confirm your email" };
export const dynamic = "force-dynamic";

const LINK_ERRORS: Record<string, string> = {
  expired: "That link has expired or was replaced by a newer email. Enter your latest code, or send a new one.",
  invalid: "That link isn't valid. Enter the code from your latest email, or send a new one.",
};

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const email = (sp.email ?? "").trim().toLowerCase();

  if (!email) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="text-lg font-bold">Confirm your email</h1>
        {sp.error && <Alert tone="error">{LINK_ERRORS[sp.error] ?? LINK_ERRORS.invalid}</Alert>}
        <p className="text-sm text-slate-700">Log in with your email and password and we&apos;ll send you a new code.</p>
        <Link href="/login" className={`${btn.primary} w-full`}>Log in</Link>
      </div>
    );
  }

  const notice = sp.error
    ? { text: LINK_ERRORS[sp.error] ?? LINK_ERRORS.invalid, tone: "error" as const }
    : sp.unsent
      ? { text: "Your account is created, but the email couldn't be sent. Tap “Send a new code”.", tone: "error" as const }
      : sp.sent
        ? { text: "Code sent. It expires in 30 minutes.", tone: "ok" as const }
        : undefined;

  return <VerifyEmailForm email={email} notice={notice?.text} noticeTone={notice?.tone} />;
}
