"use strict";

// F-2.5 (PLAN/ROADMAP_EXPANSION.md): per-tool budget envelope.
//
// Caps tool invocations per cycle so a runaway loop or unbounded LLM
// behavior cannot burn through fetchUrl / webSearch / AI quota in one
// pass. Pure tracker — caller increments on use, checks before invoking.
//
// Design notes:
//   - State is plain { limits: {tool: N}, counts: {tool: N} }. Caller
//     decides where to store it (per-cycle context, state.json scoped,
//     etc.). Module never persists.
//   - All mutation returns a NEW state object (purity). Callers can
//     thread it through a cycle without worrying about shared mutation.
//   - Unknown tools fail-closed at check time and are silently no-op
//     on consume (don't auto-create unbounded buckets).
//   - Defaults are conservative: enough for a normal cycle, low enough
//     that an attacker-controlled prompt cannot exfiltrate via N fetches.

const DEFAULT_TOOL_BUDGET = Object.freeze({
  fetchUrl: 10,
  webSearch: 5,
  aiCall: 30,
  openIssue: 3,
  commentOnIssue: 10,
  castFarcaster: 3
});

function initToolBudgetState(limits) {
  const resolvedLimits = (limits && typeof limits === "object")
    ? { ...limits }
    : { ...DEFAULT_TOOL_BUDGET };
  const counts = {};
  for (const tool of Object.keys(resolvedLimits)) counts[tool] = 0;
  return { limits: resolvedLimits, counts };
}

function checkToolBudget(state, tool, options = {}) {
  if (!state || typeof state !== "object" || !state.limits || !state.counts) {
    return { ok: false, kind: "bad_state" };
  }
  if (!Object.prototype.hasOwnProperty.call(state.limits, tool)) {
    return { ok: false, kind: "unknown_tool", tool };
  }
  const limit = state.limits[tool];
  const used = state.counts[tool] || 0;
  const remaining = Math.max(0, limit - used);
  const requested = Number.isFinite(options.amount) ? Math.max(0, options.amount) : 1;
  if (remaining === 0) {
    return { ok: false, kind: "exhausted", tool, used, limit, remaining, requested };
  }
  if (requested > remaining) {
    return { ok: false, kind: "would_exceed", tool, used, limit, remaining, requested };
  }
  return { ok: true, tool, used, limit, remaining, requested };
}

function consumeToolBudget(state, tool, amount = 1) {
  if (!state || typeof state !== "object" || !state.limits || !state.counts) {
    return state;
  }
  if (!Object.prototype.hasOwnProperty.call(state.limits, tool)) {
    return state; // unknown tool: no-op, don't auto-create
  }
  const inc = Number.isFinite(amount) && amount > 0 ? amount : 0;
  if (inc === 0) return { limits: { ...state.limits }, counts: { ...state.counts } };
  return {
    limits: { ...state.limits },
    counts: { ...state.counts, [tool]: (state.counts[tool] || 0) + inc }
  };
}

function remainingToolBudget(state, tool) {
  if (!state || !state.limits || !state.counts) return 0;
  if (!Object.prototype.hasOwnProperty.call(state.limits, tool)) return 0;
  return Math.max(0, state.limits[tool] - (state.counts[tool] || 0));
}

function resetToolBudget(state) {
  if (!state || !state.limits) return initToolBudgetState();
  const counts = {};
  for (const tool of Object.keys(state.limits)) counts[tool] = 0;
  return { limits: { ...state.limits }, counts };
}

function budgetSnapshot(state) {
  if (!state || !state.limits || !state.counts) return [];
  return Object.keys(state.limits).map((tool) => {
    const limit = state.limits[tool];
    const used = state.counts[tool] || 0;
    const remaining = Math.max(0, limit - used);
    return { tool, used, limit, remaining, exhausted: remaining === 0 };
  });
}

module.exports = {
  DEFAULT_TOOL_BUDGET,
  budgetSnapshot,
  checkToolBudget,
  consumeToolBudget,
  initToolBudgetState,
  remainingToolBudget,
  resetToolBudget
};
