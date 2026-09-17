import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticStatus, displayStatus, shiftPhase, shiftWindow, zonedTimeToUtc } from "./shift-time";

const SYD = "Australia/Sydney";
const iso = (ms: number) => new Date(ms).toISOString();

test("Sydney standard time (AEST, UTC+10) in September", () => {
  assert.equal(iso(zonedTimeToUtc("2026-09-17", "07:00", SYD)), "2026-09-16T21:00:00.000Z");
});

test("Sydney daylight saving (AEDT, UTC+11) after the first Sunday in October", () => {
  assert.equal(iso(zonedTimeToUtc("2026-10-08", "07:00", SYD)), "2026-10-07T20:00:00.000Z");
  // 02:30 doesn't exist on 04/10/2026 (clocks jump 2:00 → 3:00); it lands on 03:30 local = 16:30Z
  assert.equal(iso(zonedTimeToUtc("2026-10-04", "02:30", SYD)), "2026-10-03T16:30:00.000Z");
});

test("Thursday 7–9 and 9–11: scheduled before, working now during, finished after", () => {
  const a = shiftWindow("2026-09-17", "07:00", "09:00", SYD);
  const b = shiftWindow("2026-09-17", "09:00", "11:00", SYD);
  const at = (t: string) => zonedTimeToUtc("2026-09-17", t, SYD);
  assert.equal(shiftPhase(at("06:59"), a), "upcoming");
  assert.equal(shiftPhase(at("07:00"), a), "in-progress");
  assert.equal(shiftPhase(at("08:59"), a), "in-progress");
  assert.equal(shiftPhase(at("09:00"), a), "finished");
  assert.equal(shiftPhase(at("09:00"), b), "in-progress");
  assert.equal(shiftPhase(at("11:00"), b), "finished");
});

test("overnight shift ends the next morning", () => {
  const w = shiftWindow("2026-09-17", "22:00", "06:00", SYD);
  assert.equal(iso(w.endMs), "2026-09-17T20:00:00.000Z"); // 06:00 on the 18th in Sydney
  assert.equal(shiftPhase(zonedTimeToUtc("2026-09-18", "05:59", SYD), w), "in-progress");
  assert.equal(shiftPhase(zonedTimeToUtc("2026-09-18", "06:00", SYD), w), "finished");
});

test("automatic status only moves scheduled/confirmed to completed after the end", () => {
  assert.equal(automaticStatus("SCHEDULED", "upcoming"), "SCHEDULED");
  assert.equal(automaticStatus("CONFIRMED", "in-progress"), "CONFIRMED");
  assert.equal(automaticStatus("SCHEDULED", "finished"), "COMPLETED");
  assert.equal(automaticStatus("CANCELLED", "finished"), "CANCELLED");
});

test("display labels", () => {
  assert.deepEqual(displayStatus("SCHEDULED", "upcoming", true), { key: "SCHEDULED", label: "Scheduled" });
  assert.deepEqual(displayStatus("CONFIRMED", "upcoming", true), { key: "CONFIRMED", label: "Confirmed" });
  assert.deepEqual(displayStatus("SCHEDULED", "in-progress", true), { key: "IN_PROGRESS", label: "Working now" });
  assert.deepEqual(displayStatus("SCHEDULED", "finished", true), { key: "COMPLETED", label: "Completed" });
  assert.deepEqual(displayStatus("SCHEDULED", "finished", false), { key: "SCHEDULED", label: "Scheduled" }, "manual status is respected");
  assert.deepEqual(displayStatus("SCHEDULED", "finished", true, false), { key: "SCHEDULED", label: "Scheduled" }, "setting turned off");
  assert.deepEqual(displayStatus("CANCELLED", "in-progress", true), { key: "CANCELLED", label: "Cancelled" });
});
