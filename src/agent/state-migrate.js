"use strict";

// F-1.1 (PLAN/ROADMAP_EXPANSION.md): state.json schema migration system.
//
// Versioned migrations with rollback. Each migration step is one
// from→to transform pair (up + down). Forward migration applies up()
// in order. Backward migration applies down() in reverse. If any step
// throws, the chain rolls back through the inverse transforms back to
// the original schemaVersion — state.json is never half-migrated.
//
// This module is the pure mechanism. The cycle (run.js) decides:
//   1) target schema version (CURRENT_STATE_SCHEMA_VERSION),
//   2) which concrete migrations to register (none yet — initial release
//      defines version 1 as the baseline; future schema changes append),
//   3) when to invoke migrateState (on state.json load, before any cycle
//      logic reads from it).
//
// Why explicit version vs auto-derivation: state.json shape is load-bearing
// for every consumer (cycle, dashboard, SDK readers). An explicit version
// pin tells the cycle "this is the shape I was last written under," so a
// reader written against a future shape can refuse to load (and surface
// the version drift as an issue, not a crash deep in unrelated logic).

const CURRENT_STATE_SCHEMA_VERSION = 1;

function buildMigrationRegistry(steps) {
  const reg = new Map();
  if (!Array.isArray(steps)) return reg;
  // Sort by `from` so contiguity check is deterministic.
  const sorted = steps.slice().sort((a, b) => a.from - b.from);
  for (let i = 0; i < sorted.length; i++) {
    const step = sorted[i];
    if (!step || typeof step.up !== "function" || typeof step.down !== "function") {
      throw new Error(`migration step at index ${i} requires up + down functions`);
    }
    if (!Number.isInteger(step.from) || !Number.isInteger(step.to)) {
      throw new Error(`migration step at index ${i} requires integer from + to`);
    }
    if (step.to <= step.from) {
      throw new Error(`migration step ${step.from}→${step.to} must go forward (to > from)`);
    }
    if (i > 0) {
      const prev = sorted[i - 1];
      if (step.from !== prev.to) {
        throw new Error(`gap in migration chain: ${prev.from}→${prev.to} then ${step.from}→${step.to}`);
      }
    }
    reg.set(step.from, step);
  }
  return reg;
}

function planMigration(registry, currentVersion, targetVersion) {
  if (currentVersion === targetVersion) {
    return { direction: "noop", steps: [] };
  }
  if (currentVersion < targetVersion) {
    const steps = [];
    let v = currentVersion;
    while (v < targetVersion) {
      const step = registry.get(v);
      if (!step) {
        throw new Error(`no migration registered for ${v}→${v + 1} (target ${targetVersion})`);
      }
      steps.push(step);
      v = step.to;
    }
    return { direction: "up", steps };
  }
  // Backward: walk the registry by .to to find the down chain.
  const byTo = new Map();
  for (const step of registry.values()) byTo.set(step.to, step);
  const steps = [];
  let v = currentVersion;
  while (v > targetVersion) {
    const step = byTo.get(v);
    if (!step) {
      throw new Error(`no migration registered for ${v - 1}→${v} (cannot roll back)`);
    }
    steps.push(step);
    v = step.from;
  }
  return { direction: "down", steps };
}

function migrateState(state, targetVersion, registry) {
  const inputState = state && typeof state === "object" ? state : {};
  const currentVersion = Number.isInteger(inputState.schemaVersion)
    ? inputState.schemaVersion
    : 1;
  let plan;
  try {
    plan = planMigration(registry, currentVersion, targetVersion);
  } catch (err) {
    return { ok: false, reason: err.message, state: { ...inputState }, applied: [] };
  }
  if (plan.direction === "noop") {
    return {
      ok: true,
      state: { ...inputState, schemaVersion: targetVersion },
      applied: []
    };
  }

  // Apply step-by-step on a snapshot. Maintain history for rollback.
  const history = []; // entries: { step, before }
  let workingState = { ...inputState };
  try {
    if (plan.direction === "up") {
      for (const step of plan.steps) {
        const before = { ...workingState };
        const transformed = step.up({ ...workingState });
        workingState = { ...transformed, schemaVersion: step.to };
        history.push({ step, before });
      }
    } else {
      for (const step of plan.steps) {
        const before = { ...workingState };
        const transformed = step.down({ ...workingState });
        workingState = { ...transformed, schemaVersion: step.from };
        history.push({ step, before });
      }
    }
    return {
      ok: true,
      state: workingState,
      applied: plan.steps.map((s) => ({ from: s.from, to: s.to }))
    };
  } catch (err) {
    // Rollback: walk history in reverse, restore the `before` snapshot.
    // Original input is `history[0].before` if any steps ran. Otherwise
    // workingState was never mutated past inputState.
    const rolledBack = history.length > 0
      ? { ...history[0].before }
      : { ...inputState };
    return {
      ok: false,
      reason: `migration_failed: ${err.message}`,
      state: rolledBack,
      applied: []
    };
  }
}

module.exports = {
  CURRENT_STATE_SCHEMA_VERSION,
  buildMigrationRegistry,
  migrateState,
  planMigration
};
