"use client";

import Link from "next/link";
import { useState } from "react";
import { btn } from "./ui";
import { Alert, Field } from "./ui";

/**
 * Plain HTML forms that post to /api/login and /api/signup.
 * Using a normal form post (rather than a fetch-based server action) means signing in is a real
 * navigation, which is what makes browsers and password managers offer to save your details.
 */
function SubmitButton({ busy, children, pendingText }: { busy: boolean; children: React.ReactNode; pendingText: string }) {
  return (
    <button type="submit" disabled={busy} className={`${btn.primary} w-full disabled:opacity-50`}>
      {busy ? pendingText : children}
    </button>
  );
}

export function LoginForm({ error, email }: { error?: string; email?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <form method="post" action="/api/login" onSubmit={() => setBusy(true)} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h1 className="mb-4 text-lg font-bold">Log in</h1>
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="username" inputMode="email" defaultValue={email ?? ""} required className="input" />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </Field>
      {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}
      <SubmitButton busy={busy} pendingText="Logging in…">Log in</SubmitButton>
      <p className="mt-4 text-center text-sm text-slate-600">
        New here? <Link href="/signup" className="font-semibold text-ink underline">Create an account</Link>
      </p>
    </form>
  );
}

export function SignupForm({ allowed, error, name, email, sample }: {
  allowed: boolean; error?: string; name?: string; email?: string; sample?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  if (!allowed) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="mb-2 text-lg font-bold">Sign-up is turned off</h1>
        <p className="text-sm text-slate-600">This ShiftBook is private. <Link href="/login" className="font-semibold text-ink underline">Log in</Link></p>
      </div>
    );
  }
  return (
    <form method="post" action="/api/signup" onSubmit={() => setBusy(true)} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h1 className="mb-4 text-lg font-bold">Create your account</h1>
      <Field label="Name (optional)" htmlFor="name">
        <input id="name" name="name" autoComplete="name" defaultValue={name ?? ""} className="input" />
      </Field>
      <Field label="Email" htmlFor="email" hint="We'll send a code to confirm it's yours">
        <input id="email" name="email" type="email" autoComplete="username" inputMode="email" defaultValue={email ?? ""} required className="input" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters">
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </Field>
      <label className="mb-4 flex items-start gap-3 text-sm">
        <input type="checkbox" name="sample" defaultChecked={sample ?? true} className="mt-0.5 h-6 w-6 accent-ink" />
        <span>Start with the example roster: Adairs Bondi, Aldi Edgecliff and Officeworks Northrocks on 14/09/2026 (no rates set).</span>
      </label>
      {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}
      <SubmitButton busy={busy} pendingText="Creating account…">Create account</SubmitButton>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account? <Link href="/login" className="font-semibold text-ink underline">Log in</Link>
      </p>
    </form>
  );
}
