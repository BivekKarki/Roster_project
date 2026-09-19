import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABEL, type Status } from "@/lib/types";
import { ProfileMenu } from "./ProfileMenu";

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-base font-semibold text-white active:bg-ink-dark disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-700 active:bg-slate-50",
  go: "inline-flex items-center justify-center gap-2 rounded-xl bg-go px-4 py-3 text-base font-semibold text-white active:brightness-95 disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-3 text-base font-semibold text-red-700",
};

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-ink text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-white/80">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="page-in pb-nav mx-auto max-w-md space-y-3 px-3 pt-3">{children}</main>;
}

export function Card({ children, className = "bg-white border-slate-200" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border p-4 ${className}`}>{children}</section>;
}

export function Stat({ label, value, hint, className = "bg-slate-50" }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-3 ${className}`}>
      <div className="text-xs text-slate-600">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {hint && <div className="num text-xs text-slate-600">{hint}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  SCHEDULED: "bg-slate-100 text-slate-700 border-slate-300",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-300",
  COMPLETED: "bg-green-100 text-green-800 border-green-300",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="mb-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      ) : (
        <div className="mb-1 text-sm font-medium text-slate-600">{label}</div>
      )}
      {children}
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function SegmentedLinks({ options, value }: { options: { value: string; label: string; href: string }[]; value: string }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <Link key={o.value} href={o.href} replace scroll={false}
          className={`rounded-xl border py-3 text-center text-sm font-semibold ${o.value === value ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"}`}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "error" | "ok" }) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-slate-800",
    warn: "bg-yellow-50 border-yellow-300 text-slate-800",
    error: "bg-red-50 border-red-300 text-red-800",
    ok: "bg-green-50 border-green-300 text-green-900",
  };
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${styles[tone]}`}>{children}</div>;
}
