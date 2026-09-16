import assert from "node:assert/strict";
import { test } from "node:test";
import { isCodeFormat, maskEmail, normaliseCode, resendDecision, waitText } from "./verification-rules";

test("code format", () => {
  assert.equal(isCodeFormat("012345"), true);
  assert.equal(isCodeFormat("12345"), false);
  assert.equal(isCodeFormat("12345a"), false);
  assert.equal(normaliseCode(" 123 456 "), "123456");
  assert.equal(normaliseCode("123-456"), "123456");
});

test("resend: 60 s cooldown", () => {
  const now = 10_000_000;
  assert.deepEqual(resendDecision([], now), { allowed: true });
  assert.deepEqual(resendDecision([now - 20_000], now), { allowed: false, reason: "cooldown", retryAfterSeconds: 40 });
  assert.deepEqual(resendDecision([now - 61_000], now), { allowed: true });
});

test("resend: at most 5 emails per hour", () => {
  const now = 10_000_000;
  const five = [now - 2 * 60_000, now - 10 * 60_000, now - 20 * 60_000, now - 30 * 60_000, now - 50 * 60_000];
  const d = resendDecision(five, now);
  assert.equal(d.allowed, false);
  assert.equal(!d.allowed && d.reason, "hourly-limit");
  assert.equal(!d.allowed && d.retryAfterSeconds, 10 * 60);
  assert.deepEqual(resendDecision(five.slice(1).concat(now - 61 * 60_000), now), { allowed: true });
});

test("mask email and wait text", () => {
  assert.equal(maskEmail("john@test.com"), "j***@test.com");
  assert.equal(maskEmail("a@b.com"), "a**@b.com");
  assert.equal(waitText(40), "40 seconds");
  assert.equal(waitText(600), "10 minutes");
});
