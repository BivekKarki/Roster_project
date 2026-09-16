import assert from "node:assert/strict";
import { test } from "node:test";
import { avatarColour, idleState, initialFor, sessionEndReason, sessionMaxDays } from "./session-rules";

test("idle timeout ends the session after the chosen minutes", () => {
  const now = 1_000_000;
  assert.equal(sessionEndReason({ loginAt: now - 100, lastActivity: now - 29 * 60, idleMinutes: 30 }, now), null);
  assert.equal(sessionEndReason({ loginAt: now - 100, lastActivity: now - 31 * 60, idleMinutes: 30 }, now), "idle");
  assert.equal(sessionEndReason({ loginAt: now - 100, lastActivity: now - 10 * 86_400, idleMinutes: 0 }, now), null);
});

test("maximum session length applies even when active", () => {
  const now = 100_000_000;
  assert.equal(sessionEndReason({ loginAt: now - 31 * 86_400, lastActivity: now, idleMinutes: 0 }, now, 30), "max-age");
  assert.equal(sessionEndReason({ loginAt: now - 29 * 86_400, lastActivity: now, idleMinutes: 0 }, now, 30), null);
});

test("tokens from before this feature (no times) stay valid until they are refreshed", () => {
  assert.equal(sessionEndReason({}, 123), null);
});

test("SESSION_MAX_DAYS parsing", () => {
  assert.equal(sessionMaxDays(undefined), 30);
  assert.equal(sessionMaxDays("7"), 7);
  assert.equal(sessionMaxDays("nope"), 30);
  assert.equal(sessionMaxDays("-1"), 30);
});

test("browser countdown: active, warning in the last 60 s, then expired", () => {
  const start = 0;
  assert.equal(idleState(start, 28 * 60_000, 30).phase, "active");
  const w = idleState(start, 29 * 60_000 + 15_000, 30);
  assert.equal(w.phase, "warning");
  assert.equal(w.secondsLeft, 45);
  assert.equal(idleState(start, 30 * 60_000, 30).phase, "expired");
  assert.equal(idleState(start, 10 ** 12, 0).phase, "active");
});

test("avatar initial and colour", () => {
  assert.equal(initialFor("bivek", "x@y.com"), "B");
  assert.equal(initialFor("  ", "john@test.com"), "J");
  assert.equal(initialFor(null, null), "?");
  assert.equal(avatarColour("John"), avatarColour("John"));
});
