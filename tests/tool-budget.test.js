"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_TOOL_BUDGET,
  initToolBudgetState,
  checkToolBudget,
  consumeToolBudget,
  remainingToolBudget,
  resetToolBudget,
  budgetSnapshot
} = require("../src/agent/tool-budget");

// F-2.5 (PLAN/ROADMAP_EXPANSION.md): per-tool budget envelope.
// Caps tool invocations per cycle so a runaway loop or unbounded LLM
// behavior can't burn through fetchUrl / webSearch / AI quota in one
// cycle. Pure tracker — caller increments on use.

test("DEFAULT_TOOL_BUDGET has sensible caps for the well-known tools", () => {
  assert.ok(DEFAULT_TOOL_BUDGET.fetchUrl >= 1);
  assert.ok(DEFAULT_TOOL_BUDGET.webSearch >= 1);
  assert.ok(DEFAULT_TOOL_BUDGET.aiCall >= 1);
});

test("initToolBudgetState: returns empty counters keyed by configured tools", () => {
  const state = initToolBudgetState({ fetchUrl: 5, webSearch: 3 });
  assert.equal(state.counts.fetchUrl, 0);
  assert.equal(state.counts.webSearch, 0);
  assert.deepEqual(state.limits, { fetchUrl: 5, webSearch: 3 });
});

test("initToolBudgetState: uses DEFAULT_TOOL_BUDGET when no override", () => {
  const state = initToolBudgetState();
  assert.equal(state.limits.fetchUrl, DEFAULT_TOOL_BUDGET.fetchUrl);
  assert.equal(state.counts.fetchUrl, 0);
});

test("checkToolBudget: tool under cap → ok:true with remaining", () => {
  const state = initToolBudgetState({ fetchUrl: 3 });
  const result = checkToolBudget(state, "fetchUrl");
  assert.equal(result.ok, true);
  assert.equal(result.remaining, 3);
  assert.equal(result.used, 0);
  assert.equal(result.limit, 3);
});

test("consumeToolBudget: increments counter, returns updated state", () => {
  const state = initToolBudgetState({ fetchUrl: 3 });
  const after = consumeToolBudget(state, "fetchUrl");
  assert.equal(after.counts.fetchUrl, 1);
  assert.equal(state.counts.fetchUrl, 0, "input must not be mutated (purity)");
});

test("consumeToolBudget: increment by N", () => {
  const state = initToolBudgetState({ fetchUrl: 5 });
  const after = consumeToolBudget(state, "fetchUrl", 3);
  assert.equal(after.counts.fetchUrl, 3);
});

test("checkToolBudget: tool at cap → ok:false with kind=exhausted", () => {
  let state = initToolBudgetState({ fetchUrl: 2 });
  state = consumeToolBudget(state, "fetchUrl");
  state = consumeToolBudget(state, "fetchUrl");
  const result = checkToolBudget(state, "fetchUrl");
  assert.equal(result.ok, false);
  assert.equal(result.kind, "exhausted");
  assert.equal(result.remaining, 0);
});

test("checkToolBudget: tool not in budget → ok:false with kind=unknown_tool", () => {
  const state = initToolBudgetState({ fetchUrl: 3 });
  const result = checkToolBudget(state, "not-a-real-tool");
  assert.equal(result.ok, false);
  assert.equal(result.kind, "unknown_tool");
});

test("checkToolBudget: zero-limit tool → exhausted from the start", () => {
  const state = initToolBudgetState({ disabledTool: 0 });
  const result = checkToolBudget(state, "disabledTool");
  assert.equal(result.ok, false);
  assert.equal(result.kind, "exhausted");
});

test("remainingToolBudget: returns limit - used", () => {
  let state = initToolBudgetState({ fetchUrl: 5 });
  assert.equal(remainingToolBudget(state, "fetchUrl"), 5);
  state = consumeToolBudget(state, "fetchUrl", 2);
  assert.equal(remainingToolBudget(state, "fetchUrl"), 3);
  state = consumeToolBudget(state, "fetchUrl", 3);
  assert.equal(remainingToolBudget(state, "fetchUrl"), 0);
});

test("remainingToolBudget: never returns negative", () => {
  let state = initToolBudgetState({ fetchUrl: 2 });
  state = consumeToolBudget(state, "fetchUrl", 10);
  assert.equal(remainingToolBudget(state, "fetchUrl"), 0);
});

test("remainingToolBudget: unknown tool → 0", () => {
  const state = initToolBudgetState({ fetchUrl: 5 });
  assert.equal(remainingToolBudget(state, "ghost-tool"), 0);
});

test("resetToolBudget: zeroes all counters but preserves limits", () => {
  let state = initToolBudgetState({ fetchUrl: 5, webSearch: 3 });
  state = consumeToolBudget(state, "fetchUrl", 4);
  state = consumeToolBudget(state, "webSearch", 1);
  const after = resetToolBudget(state);
  assert.equal(after.counts.fetchUrl, 0);
  assert.equal(after.counts.webSearch, 0);
  assert.equal(after.limits.fetchUrl, 5);
  assert.equal(after.limits.webSearch, 3);
});

test("consumeToolBudget: unknown tool → returns state unchanged (no auto-create)", () => {
  const state = initToolBudgetState({ fetchUrl: 5 });
  const after = consumeToolBudget(state, "ghost-tool");
  assert.equal(after.counts.fetchUrl, 0);
  assert.equal(after.counts["ghost-tool"], undefined);
});

test("budgetSnapshot: returns {tool, used, limit, remaining, exhausted} per tool", () => {
  let state = initToolBudgetState({ fetchUrl: 5, webSearch: 3 });
  state = consumeToolBudget(state, "fetchUrl", 2);
  state = consumeToolBudget(state, "webSearch", 3);
  const snap = budgetSnapshot(state);
  const fetchRow = snap.find((r) => r.tool === "fetchUrl");
  const searchRow = snap.find((r) => r.tool === "webSearch");
  assert.deepEqual(fetchRow, { tool: "fetchUrl", used: 2, limit: 5, remaining: 3, exhausted: false });
  assert.deepEqual(searchRow, { tool: "webSearch", used: 3, limit: 3, remaining: 0, exhausted: true });
});

test("consumeToolBudget: negative increment → no-op (defense)", () => {
  let state = initToolBudgetState({ fetchUrl: 5 });
  const after = consumeToolBudget(state, "fetchUrl", -3);
  assert.equal(after.counts.fetchUrl, 0);
});

test("checkToolBudget: required amount > remaining → ok:false", () => {
  let state = initToolBudgetState({ fetchUrl: 3 });
  state = consumeToolBudget(state, "fetchUrl", 2);
  const result = checkToolBudget(state, "fetchUrl", { amount: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "would_exceed");
  assert.equal(result.remaining, 1);
  assert.equal(result.requested, 2);
});

test("checkToolBudget: required amount ≤ remaining → ok:true", () => {
  let state = initToolBudgetState({ fetchUrl: 5 });
  state = consumeToolBudget(state, "fetchUrl", 2);
  const result = checkToolBudget(state, "fetchUrl", { amount: 3 });
  assert.equal(result.ok, true);
  assert.equal(result.remaining, 3);
});
