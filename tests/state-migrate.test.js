"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CURRENT_STATE_SCHEMA_VERSION,
  buildMigrationRegistry,
  migrateState,
  planMigration
} = require("../src/agent/state-migrate");

// F-1.1 (PLAN/ROADMAP_EXPANSION.md): versioned state.json schema with
// rollback-able migrations. Module is the pure mechanism; concrete
// migrations are registered as a list. The cycle (run.js) wires it.

test("CURRENT_STATE_SCHEMA_VERSION is a positive integer", () => {
  assert.equal(Number.isInteger(CURRENT_STATE_SCHEMA_VERSION), true);
  assert.ok(CURRENT_STATE_SCHEMA_VERSION >= 1);
});

test("buildMigrationRegistry: empty list → empty registry", () => {
  const reg = buildMigrationRegistry([]);
  assert.equal(reg.size, 0);
});

test("buildMigrationRegistry: ascending steps → registry keyed by from-version", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => ({ ...s, b: 1 }), down: (s) => { const { b, ...r } = s; return r; } },
    { from: 2, to: 3, up: (s) => ({ ...s, c: 1 }), down: (s) => { const { c, ...r } = s; return r; } }
  ]);
  assert.equal(reg.size, 2);
  assert.ok(reg.has(1));
  assert.ok(reg.has(2));
});

test("buildMigrationRegistry: non-contiguous steps throw (gap detection)", () => {
  assert.throws(() => {
    buildMigrationRegistry([
      { from: 1, to: 2, up: (s) => s, down: (s) => s },
      { from: 3, to: 4, up: (s) => s, down: (s) => s }
    ]);
  }, /gap|contiguous|missing/i);
});

test("buildMigrationRegistry: backwards step (to ≤ from) throws", () => {
  assert.throws(() => {
    buildMigrationRegistry([
      { from: 2, to: 1, up: (s) => s, down: (s) => s }
    ]);
  }, /forward|to > from/i);
});

test("planMigration: same version → empty plan", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => s, down: (s) => s }
  ]);
  const plan = planMigration(reg, 1, 1);
  assert.deepEqual(plan.steps, []);
  assert.equal(plan.direction, "noop");
});

test("planMigration: forward 1→3 → up steps in order", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => s, down: (s) => s },
    { from: 2, to: 3, up: (s) => s, down: (s) => s }
  ]);
  const plan = planMigration(reg, 1, 3);
  assert.equal(plan.direction, "up");
  assert.deepEqual(plan.steps.map((s) => [s.from, s.to]), [[1, 2], [2, 3]]);
});

test("planMigration: backward 3→1 → down steps reversed", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => s, down: (s) => s },
    { from: 2, to: 3, up: (s) => s, down: (s) => s }
  ]);
  const plan = planMigration(reg, 3, 1);
  assert.equal(plan.direction, "down");
  assert.deepEqual(plan.steps.map((s) => [s.from, s.to]), [[2, 3], [1, 2]]);
});

test("planMigration: missing intermediate migration → throws", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => s, down: (s) => s }
  ]);
  assert.throws(() => planMigration(reg, 1, 3), /no migration|missing/i);
});

test("migrateState: forward apply chains up() transforms", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => ({ ...s, b: 2 }), down: (s) => { const { b, ...r } = s; return r; } },
    { from: 2, to: 3, up: (s) => ({ ...s, c: 3 }), down: (s) => { const { c, ...r } = s; return r; } }
  ]);
  const result = migrateState({ schemaVersion: 1, a: 1 }, 3, reg);
  assert.equal(result.ok, true);
  assert.equal(result.state.schemaVersion, 3);
  assert.equal(result.state.a, 1);
  assert.equal(result.state.b, 2);
  assert.equal(result.state.c, 3);
  assert.deepEqual(result.applied.map((s) => [s.from, s.to]), [[1, 2], [2, 3]]);
});

test("migrateState: backward apply chains down() transforms in reverse", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => ({ ...s, b: 2 }), down: (s) => { const { b, ...r } = s; return r; } },
    { from: 2, to: 3, up: (s) => ({ ...s, c: 3 }), down: (s) => { const { c, ...r } = s; return r; } }
  ]);
  const result = migrateState({ schemaVersion: 3, a: 1, b: 2, c: 3 }, 1, reg);
  assert.equal(result.ok, true);
  assert.equal(result.state.schemaVersion, 1);
  assert.equal(result.state.a, 1);
  assert.equal(result.state.b, undefined);
  assert.equal(result.state.c, undefined);
});

test("migrateState: defaults to schemaVersion 1 when missing", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => ({ ...s, b: 2 }), down: (s) => { const { b, ...r } = s; return r; } }
  ]);
  const result = migrateState({ /* no schemaVersion */ a: 1 }, 2, reg);
  assert.equal(result.ok, true);
  assert.equal(result.state.schemaVersion, 2);
  assert.equal(result.state.b, 2);
});

test("migrateState: failure mid-chain → rolls back to original via down()", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => ({ ...s, b: 2 }), down: (s) => { const { b, ...r } = s; return r; } },
    { from: 2, to: 3, up: () => { throw new Error("boom"); }, down: (s) => s }
  ]);
  const original = { schemaVersion: 1, a: 1 };
  const result = migrateState(original, 3, reg);
  assert.equal(result.ok, false);
  assert.match(result.reason, /boom|migration_failed/i);
  // State should be rolled back: no `b` key, schemaVersion still 1.
  assert.equal(result.state.schemaVersion, 1);
  assert.equal(result.state.b, undefined);
  assert.equal(result.state.a, 1);
});

test("migrateState: target equal to current → no-op, ok:true", () => {
  const reg = buildMigrationRegistry([]);
  const result = migrateState({ schemaVersion: 1 }, 1, reg);
  assert.equal(result.ok, true);
  assert.equal(result.state.schemaVersion, 1);
  assert.deepEqual(result.applied, []);
});

test("migrateState: never mutates input state object", () => {
  const reg = buildMigrationRegistry([
    { from: 1, to: 2, up: (s) => ({ ...s, b: 2 }), down: (s) => { const { b, ...r } = s; return r; } }
  ]);
  const original = { schemaVersion: 1, a: 1 };
  const result = migrateState(original, 2, reg);
  assert.equal(result.ok, true);
  // Input untouched
  assert.equal(original.schemaVersion, 1);
  assert.equal(original.b, undefined);
  // Output distinct
  assert.notEqual(result.state, original);
});
