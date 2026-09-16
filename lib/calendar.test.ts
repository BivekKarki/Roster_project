import assert from "node:assert/strict";
import { test } from "node:test";
import { addMonths, defaultSelectedDay, employerColours, isMonthKey, monthBounds, monthGrid, monthLabel } from "./calendar";

test("September 2026 grid starts Mon 31/08 and ends Sun 04/10 (5 weeks)", () => {
  const g = monthGrid("2026-09");
  assert.equal(g.start, "2026-08-31");
  assert.equal(g.end, "2026-10-04");
  assert.equal(g.weeks, 5);
  assert.equal(g.days.length, 35);
  assert.ok(g.days.includes("2026-09-14"));
});

test("a month starting on Sunday needs 6 weeks (March 2026)", () => {
  const g = monthGrid("2026-03");
  assert.equal(g.start, "2026-02-23");
  assert.equal(g.weeks, 6);
});

test("February 2027 starts on Monday", () => {
  assert.equal(monthGrid("2027-02").start, "2027-02-01");
});

test("month helpers", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(monthLabel("2026-09"), "September 2026");
  assert.deepEqual(monthBounds("2028-02"), { first: "2028-02-01", last: "2028-02-29" });
  assert.equal(isMonthKey("2026-09"), true);
  assert.equal(isMonthKey("2026-13"), false);
});

test("selected day defaults", () => {
  assert.equal(defaultSelectedDay("2026-09", "2026-09-16"), "2026-09-16");
  assert.equal(defaultSelectedDay("2026-10", "2026-09-16"), "2026-10-01");
  assert.equal(defaultSelectedDay("2026-09", "2026-09-16", "2026-09-14"), "2026-09-14");
  assert.equal(defaultSelectedDay("2026-09", "2026-09-16", "2026-10-02"), "2026-09-16");
});

test("employer colours are distinct and stable", () => {
  const a = employerColours(["Officeworks", "Adairs", "Aldi", "Adairs"]);
  assert.equal(new Set(Object.values(a)).size, 3);
  assert.deepEqual(a, employerColours(["Aldi", "Officeworks", "Adairs"]));
});
