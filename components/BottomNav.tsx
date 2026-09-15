"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/roster", label: "Roster", icon: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h3M8 16h6" },
  { href: "/shifts", label: "Shifts", icon: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" },
  { href: "/unpaid", label: "Unpaid", icon: "M3 7h18v12H3zM3 11h18M7 15h3M16 3l-9 4" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];

export function BottomNav({ overdueCount }: { overdueCount: number }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const onForm = pathname.startsWith("/shifts/") || pathname.startsWith("/settings/sites");

  return (
    <>
      {!onForm && (
        <Link href={`/shifts/new?returnTo=${encodeURIComponent(pathname)}`}
          className="bottom-nav-offset fixed right-4 z-30 flex items-center gap-2 rounded-full bg-go px-5 py-4 text-base font-bold text-white shadow-lg shadow-green-900/30">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
          Add shift
        </Link>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid h-16 max-w-md grid-cols-5">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center ${active ? "text-ink" : "text-slate-500"}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                <span className={`mt-0.5 text-xs ${active ? "font-bold" : ""}`}>{t.label}</span>
                {t.href === "/unpaid" && overdueCount > 0 && (
                  <span className="absolute right-[22%] top-1.5 rounded-full bg-red-600 px-1.5 text-xs text-white">{overdueCount}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
