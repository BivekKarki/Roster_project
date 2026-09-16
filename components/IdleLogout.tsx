"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { idleLogout } from "@/app/actions/profile";
import { idleState } from "@/lib/session-rules";

const STORAGE_KEY = "shiftbook:lastActivity"; // shared by all open tabs
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;
const PING_EVERY_MS = 60_000; // keep the server session alive while the user is active

const readLast = (fallback: number) => {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Logs the user out after `minutes` without activity, with a 60-second warning.
 * The server enforces the same timeout, so this is the friendly front end of it.
 */
export function IdleLogout({ minutes }: { minutes: number }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastPing = useRef(Date.now());
  const loggingOut = useRef(false);
  const fallbackLast = useRef(Date.now());

  const logoutNow = useCallback(() => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    idleLogout().catch(() => window.location.assign("/login?reason=idle"));
  }, []);

  const markActive = useCallback(() => {
    const now = Date.now();
    fallbackLast.current = now;
    try { localStorage.setItem(STORAGE_KEY, String(now)); } catch { /* private mode */ }
    setSecondsLeft(null);
    if (now - lastPing.current > PING_EVERY_MS) {
      lastPing.current = now;
      fetch("/api/auth/session", { cache: "no-store" })
        .then((r) => r.json())
        .then((s) => { if (!s?.user) window.location.assign("/login?reason=idle"); })
        .catch(() => { /* offline: the timer still applies */ });
    }
  }, []);

  useEffect(() => {
    if (minutes <= 0) return;
    markActive();

    let throttled = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - throttled < 5_000) return; // write at most every 5 s
      throttled = now;
      markActive();
    };
    const check = () => {
      if (loggingOut.current) return;
      const state = idleState(readLast(fallbackLast.current), Date.now(), minutes);
      if (state.phase === "expired") logoutNow();
      else setSecondsLeft(state.phase === "warning" ? state.secondsLeft : null);
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", check); // phone woke up / tab refocused
    const timer = window.setInterval(check, 1_000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [minutes, markActive, logoutNow]);

  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-3 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="idle-title" className="text-lg font-bold">Still there?</h2>
        <p className="mt-1 text-slate-700">
          You&apos;ll be logged out in <span className="num font-bold">{secondsLeft}</span> seconds because there&apos;s been no activity.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={logoutNow} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700">Log out</button>
          <button type="button" onClick={() => { lastPing.current = 0; markActive(); }} className="rounded-xl bg-ink px-4 py-3 font-semibold text-white">Stay logged in</button>
        </div>
      </div>
    </div>
  );
}
