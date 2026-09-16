"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";
import { Alert, Field } from "./ui";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h1 className="mb-4 text-lg font-bold">Log in</h1>
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="input" />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </Field>
      {state?.error && <div className="mb-3"><Alert tone="error">{state.error}</Alert></div>}
      <SubmitButton pendingText="Logging in…" className="w-full">Log in</SubmitButton>
      <p className="mt-4 text-center text-sm text-slate-600">
        New here? <Link href="/signup" className="font-semibold text-ink underline">Create an account</Link>
      </p>
    </form>
  );
}

export function SignupForm({ allowed }: { allowed: boolean }) {
  const [state, action] = useActionState(signup, undefined);
  if (!allowed) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="mb-2 text-lg font-bold">Sign-up is turned off</h1>
        <p className="text-sm text-slate-600">This ShiftBook is private. <Link href="/login" className="font-semibold text-ink underline">Log in</Link></p>
      </div>
    );
  }
  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h1 className="mb-4 text-lg font-bold">Create your account</h1>
      <Field label="Name (optional)" htmlFor="name">
        <input id="name" name="name" autoComplete="given-name" className="input" />
      </Field>
      <Field label="Email" htmlFor="email" hint="We'll send a code to confirm it's yours">
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="input" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters">
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </Field>
      <label className="mb-4 flex items-start gap-3 text-sm">
        <input type="checkbox" name="sample" defaultChecked className="mt-0.5 h-6 w-6 accent-ink" />
        <span>Start with the example roster: Adairs Bondi, Aldi Edgecliff and Officeworks Northrocks on 14/09/2026 (no rates set).</span>
      </label>
      {state?.error && <div className="mb-3"><Alert tone="error">{state.error}</Alert></div>}
      <SubmitButton pendingText="Creating account…" className="w-full">Create account</SubmitButton>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account? <Link href="/login" className="font-semibold text-ink underline">Log in</Link>
      </p>
    </form>
  );
}
