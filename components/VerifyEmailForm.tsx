"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { resendVerification, verifyEmail } from "@/app/actions/auth";
import { CODE_LENGTH } from "@/lib/verification-rules";
import { SubmitButton } from "./SubmitButton";
import { Alert } from "./ui";

export function VerifyEmailForm({ email, notice, noticeTone }: { email: string; notice?: string; noticeTone?: "ok" | "error" | "info" }) {
  const [verifyState, verifyAction] = useActionState(verifyEmail, undefined);
  const [resendState, resendAction] = useActionState(resendVerification, undefined);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(notice && noticeTone === "ok" ? 60 : 0);

  useEffect(() => {
    if (resendState?.retryAfter) setWait(resendState.retryAfter);
  }, [resendState]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  return (
    <div className="space-y-3">
      <form action={verifyAction} className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="text-lg font-bold">Check your email</h1>
        <p className="mt-1 text-sm text-slate-700">
          We sent a {CODE_LENGTH}-digit code and a confirmation link to <b className="break-all">{email}</b>. Enter the code, or tap the link in the email.
        </p>
        {notice && <div className="mt-3"><Alert tone={noticeTone ?? "info"}>{notice}</Alert></div>}
        <input type="hidden" name="email" value={email} />
        <label htmlFor="code" className="mb-1 mt-4 block text-sm font-medium text-slate-600">Verification code</label>
        <input
          id="code" name="code" value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, CODE_LENGTH))}
          inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={CODE_LENGTH} required autoFocus
          placeholder="••••••"
          className="input num text-center font-mono text-3xl tracking-[0.5em]"
        />
        {verifyState?.error && <div className="mt-3"><Alert tone="error">{verifyState.error}</Alert></div>}
        <SubmitButton pendingText="Checking…" className="mt-4 w-full">Verify email</SubmitButton>
      </form>

      <form action={resendAction} className="rounded-2xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="email" value={email} />
        <p className="mb-2 text-sm text-slate-600">Didn&apos;t get it? It can take a minute, and it may be in spam or junk.</p>
        {resendState?.error && <div className="mb-2"><Alert tone="error">{resendState.error}</Alert></div>}
        {resendState?.ok && resendState.message && <div className="mb-2"><Alert tone="ok">{resendState.message}</Alert></div>}
        <SubmitButton variant="ghost" pendingText="Sending…" className="w-full" disabled={wait > 0}>
          {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-slate-600">
        Wrong email? <Link href="/signup" className="font-semibold text-ink underline">Sign up again</Link> · <Link href="/login" className="font-semibold text-ink underline">Log in</Link>
      </p>
    </div>
  );
}
