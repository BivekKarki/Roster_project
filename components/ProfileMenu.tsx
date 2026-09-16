"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";
import { Avatar } from "./Avatar";
import { useCurrentUser } from "./UserContext";

export function ProfileMenu() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}
        aria-label="Account menu" className="flex rounded-full p-0.5 active:opacity-80">
        <Avatar name={user.name} email={user.email} version={user.avatarVersion} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-30 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-200 p-3">
            <Avatar name={user.name} email={user.email} version={user.avatarVersion} size={44} className="ring-slate-100" />
            <div className="min-w-0">
              {user.name && <div className="truncate font-semibold">{user.name}</div>}
              <div className="truncate text-sm text-slate-600">{user.email}</div>
            </div>
          </div>
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="block px-4 py-3 active:bg-slate-50">Profile and auto logout</Link>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="block px-4 py-3 active:bg-slate-50">Settings</Link>
          <form action={logout} className="border-t border-slate-200">
            <button role="menuitem" type="submit" className="w-full px-4 py-3 text-left font-semibold text-red-700 active:bg-red-50">Log out</button>
          </form>
        </div>
      )}
    </div>
  );
}
