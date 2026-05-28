"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AI_KEY_ROTATION_INTERVAL_DAYS,
  AI_KEY_ROTATION_INTERVAL_MS,
  ROTATION_ISSUE_LABEL,
  evaluateAiKeyRotation
} = require("../src/agent/ai-key-rotation");

// T-6 (STABILITY_SECURITY.md): advisory-only AI key rotation reminder.
// Opens an issue at 90 days. Never auto-blocks AI work.

const DAY_MS = 24 * 60 * 60 * 1000;

test("AI_KEY_ROTATION_INTERVAL_DAYS is 90", () => {
  assert.equal(AI_KEY_ROTATION_INTERVAL_DAYS, 90);
  assert.equal(AI_KEY_ROTATION_INTERVAL_MS, 90 * DAY_MS);
});

test("ROTATION_ISSUE_LABEL is orbit:rotation-due (idempotency key)", () => {
  assert.equal(ROTATION_ISSUE_LABEL, "orbit:rotation-due");
});

test("evaluateAiKeyRotation: no rotation record → unknown (not due)", () => {
  const result = evaluateAiKeyRotation({}, new Date("2026-05-28T00:00:00Z"));
  assert.equal(result.due, false);
  assert.equal(result.status, "unknown");
  assert.equal(result.advisory, true); // T-6: never block
});

test("evaluateAiKeyRotation: rotated 30 days ago → fresh", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const lastRotatedAt = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const result = evaluateAiKeyRotation(
    { aiKeyRotation: { lastRotatedAt } },
    now
  );
  assert.equal(result.due, false);
  assert.equal(result.status, "fresh");
  assert.equal(result.ageDays, 30);
});

test("evaluateAiKeyRotation: rotated 91 days ago → due", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const lastRotatedAt = new Date(now.getTime() - 91 * DAY_MS).toISOString();
  const result = evaluateAiKeyRotation(
    { aiKeyRotation: { lastRotatedAt } },
    now
  );
  assert.equal(result.due, true);
  assert.equal(result.status, "due");
  assert.equal(result.ageDays, 91);
  assert.equal(result.advisory, true); // never block
});

test("evaluateAiKeyRotation: exactly 90 days is still fresh (strict >)", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const lastRotatedAt = new Date(now.getTime() - 90 * DAY_MS).toISOString();
  const result = evaluateAiKeyRotation(
    { aiKeyRotation: { lastRotatedAt } },
    now
  );
  assert.equal(result.due, false);
  assert.equal(result.status, "fresh");
});

test("evaluateAiKeyRotation: unparseable lastRotatedAt → unknown", () => {
  const result = evaluateAiKeyRotation(
    { aiKeyRotation: { lastRotatedAt: "not-a-date" } },
    new Date("2026-05-28T00:00:00Z")
  );
  assert.equal(result.due, false);
  assert.equal(result.status, "unknown");
});

test("evaluateAiKeyRotation: custom interval via state.aiKeyRotation.intervalDays", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const lastRotatedAt = new Date(now.getTime() - 40 * DAY_MS).toISOString();
  const result = evaluateAiKeyRotation(
    { aiKeyRotation: { lastRotatedAt, intervalDays: 30 } },
    now
  );
  assert.equal(result.due, true);
  assert.equal(result.intervalDays, 30);
});

test("evaluateAiKeyRotation: result always carries advisory:true (T-6 invariant)", () => {
  const cases = [
    {},
    { aiKeyRotation: { lastRotatedAt: new Date().toISOString() } },
    { aiKeyRotation: { lastRotatedAt: "1990-01-01T00:00:00Z" } },
    { aiKeyRotation: { lastRotatedAt: "not-a-date" } }
  ];
  for (const state of cases) {
    const result = evaluateAiKeyRotation(state, new Date());
    assert.equal(result.advisory, true, "T-6: must never auto-block");
  }
});
