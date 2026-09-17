/**
 * Real-world timing of shifts: turns a shift's date + "HH:MM" times into exact instants in the
 * app's time zone (daylight saving aware), and works out whether it hasn't started, is on now,
 * or has finished. Pure functions, used by the server and the browser.
 */
import { addDays } from "./dates";
import type { Status } from "./types";

export type ShiftPhase = "upcoming" | "in-progress" | "finished";

const partsFormatter = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string) {
  let f = partsFormatter.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-AU", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    partsFormatter.set(timeZone, f);
  }
  return f;
}

/** Offset of the time zone from UTC at an instant, in minutes (Sydney: +600 or +660). */
function offsetMinutes(utcMs: number, timeZone: string) {
  const p = Object.fromEntries(formatterFor(timeZone).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((asUtc - utcMs) / 60_000);
}

/**
 * The instant a wall-clock time happens in a time zone, e.g. 07:00 on 17/09/2026 in Sydney.
 * Times skipped by daylight saving (02:00–03:00 on the first Sunday in October) move forward.
 */
export function zonedTimeToUtc(dateIso: string, time: string, timeZone: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall - offsetMinutes(wall, timeZone) * 60_000;
  const second = wall - offsetMinutes(guess, timeZone) * 60_000;
  if (second !== guess) guess = second;
  return guess;
}

/** Start and end instants. An end time at or before the start means the shift ends the next day. */
export function shiftWindow(dateIso: string, startTime: string, endTime: string, timeZone: string) {
  const startMs = zonedTimeToUtc(dateIso, startTime, timeZone);
  const endDate = endTime <= startTime ? addDays(dateIso, 1) : dateIso;
  let endMs = zonedTimeToUtc(endDate, endTime, timeZone);
  if (endMs <= startMs) endMs = startMs + 60_000; // safety for daylight-saving edge cases
  return { startMs, endMs };
}

export function shiftPhase(nowMs: number, window: { startMs: number; endMs: number }): ShiftPhase {
  if (nowMs < window.startMs) return "upcoming";
  if (nowMs < window.endMs) return "in-progress";
  return "finished";
}

/** The status a shift should have now when automatic status is on. */
export function automaticStatus(status: Status, phase: ShiftPhase): Status {
  if (status === "CANCELLED" || status === "COMPLETED") return status;
  return phase === "finished" ? "COMPLETED" : status;
}

export type DisplayStatus = { key: Status | "IN_PROGRESS"; label: string };

/** What to show on screen: Scheduled / Confirmed before, "Working now" during, Completed after. */
export function displayStatus(status: Status, phase: ShiftPhase, autoStatus: boolean, autoEnabled = true): DisplayStatus {
  if (status === "CANCELLED") return { key: "CANCELLED", label: "Cancelled" };
  if (status === "COMPLETED") return { key: "COMPLETED", label: "Completed" };
  if (phase === "in-progress") return { key: "IN_PROGRESS", label: "Working now" };
  if (phase === "finished" && autoStatus && autoEnabled) return { key: "COMPLETED", label: "Completed" };
  return { key: status, label: status === "CONFIRMED" ? "Confirmed" : "Scheduled" };
}

export const appTimeZone = () => (typeof process !== "undefined" && process.env?.APP_TIMEZONE) || "Australia/Sydney";
