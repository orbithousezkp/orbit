"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CANONICAL_MEMORY_SCHEMAS,
  registerSchema,
  validateMemoryFile,
  validateMemoryShape,
  buildSchemaRegistry
} = require("../src/agent/memory-schema");

// F-1.6 (PLAN/ROADMAP_EXPANSION.md): pluggable JSON schema validators per
// memory/*.json file. Pure module — no fs. Pairs with memory-scan.js
// (F-1.3) which can pass a registry into its options.schemas.

test("CANONICAL_MEMORY_SCHEMAS includes the core memory files", () => {
  assert.ok(CANONICAL_MEMORY_SCHEMAS["state.json"], "state.json schema present");
  assert.ok(CANONICAL_MEMORY_SCHEMAS["governance.json"], "governance.json schema present");
  assert.ok(CANONICAL_MEMORY_SCHEMAS["treasury.json"], "treasury.json schema present");
});

test("validateMemoryFile: state.json with cycle + born → valid", () => {
  const result = validateMemoryFile("state.json", { cycle: 5, born: "2026-05-22T00:00:00Z" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test("validateMemoryFile: state.json missing required cycle → invalid", () => {
  const result = validateMemoryFile("state.json", { born: "2026-05-22T00:00:00Z" });
  assert.equal(result.ok, false);
  const missing = result.violations.find((v) => v.kind === "missing_key");
  assert.ok(missing);
  assert.equal(missing.key, "cycle");
});

test("validateMemoryFile: state.json with wrong type for cycle → invalid", () => {
  const result = validateMemoryFile("state.json", { cycle: "not-a-number", born: "2026-05-22T00:00:00Z" });
  assert.equal(result.ok, false);
  const typeErr = result.violations.find((v) => v.kind === "type_mismatch");
  assert.ok(typeErr);
  assert.equal(typeErr.key, "cycle");
  assert.equal(typeErr.expected, "number");
  assert.equal(typeErr.actual, "string");
});

test("validateMemoryFile: unknown file → ok with note (no schema = no enforcement)", () => {
  const result = validateMemoryFile("custom-blob.json", { whatever: true });
  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
  assert.equal(result.note, "no_schema_registered");
});

test("validateMemoryFile: governance.json requires ownerUsername + policyVersion", () => {
  const ok = validateMemoryFile("governance.json", { ownerUsername: "alice", policyVersion: 1 });
  assert.equal(ok.ok, true);
  const missingOwner = validateMemoryFile("governance.json", { policyVersion: 1 });
  assert.equal(missingOwner.ok, false);
  assert.ok(missingOwner.violations.find((v) => v.key === "ownerUsername"));
});

test("validateMemoryFile: treasury.json requires ai object", () => {
  const ok = validateMemoryFile("treasury.json", { ai: {} });
  assert.equal(ok.ok, true);
  const bad = validateMemoryFile("treasury.json", { ai: "not-an-object" });
  assert.equal(bad.ok, false);
  assert.ok(bad.violations.find((v) => v.kind === "type_mismatch" && v.key === "ai"));
});

test("validateMemoryShape: low-level — checks one schema object against data", () => {
  const schema = {
    required: { foo: "string", bar: "number" },
    optional: { baz: "boolean" }
  };
  assert.equal(validateMemoryShape(schema, { foo: "x", bar: 1 }).ok, true);
  assert.equal(validateMemoryShape(schema, { foo: "x", bar: 1, baz: true }).ok, true);
  assert.equal(validateMemoryShape(schema, { foo: "x" }).ok, false);
  assert.equal(validateMemoryShape(schema, { foo: 1, bar: 1 }).ok, false);
  assert.equal(validateMemoryShape(schema, { foo: "x", bar: 1, baz: "wrong" }).ok, false);
});

test("validateMemoryShape: array type checks via Array.isArray, not typeof", () => {
  const schema = { required: { items: "array" } };
  assert.equal(validateMemoryShape(schema, { items: [] }).ok, true);
  assert.equal(validateMemoryShape(schema, { items: [1, 2, 3] }).ok, true);
  assert.equal(validateMemoryShape(schema, { items: {} }).ok, false);
  assert.equal(validateMemoryShape(schema, { items: null }).ok, false);
});

test("validateMemoryShape: object type rejects arrays and null", () => {
  const schema = { required: { config: "object" } };
  assert.equal(validateMemoryShape(schema, { config: { x: 1 } }).ok, true);
  assert.equal(validateMemoryShape(schema, { config: [] }).ok, false, "array is not an object here");
  assert.equal(validateMemoryShape(schema, { config: null }).ok, false, "null is not an object here");
});

test("registerSchema: adds a custom schema to a registry", () => {
  const reg = buildSchemaRegistry({});
  registerSchema(reg, "my-feature.json", { required: { feature: "string" } });
  assert.ok(reg["my-feature.json"]);
  // validateMemoryFile via injected registry
  const result = validateMemoryFile("my-feature.json", { feature: "ok" }, reg);
  assert.equal(result.ok, true);
  const bad = validateMemoryFile("my-feature.json", { feature: 123 }, reg);
  assert.equal(bad.ok, false);
});

test("buildSchemaRegistry: starts from CANONICAL_MEMORY_SCHEMAS by default", () => {
  const reg = buildSchemaRegistry();
  assert.ok(reg["state.json"]);
  assert.ok(reg["governance.json"]);
});

test("buildSchemaRegistry: override a canonical schema by passing it in", () => {
  const reg = buildSchemaRegistry({ "state.json": { required: { custom: "string" } } });
  const result = validateMemoryFile("state.json", { custom: "x" }, reg);
  assert.equal(result.ok, true);
  // Original cycle requirement is gone because we replaced the schema
  assert.equal(validateMemoryFile("state.json", { custom: "x" }, reg).ok, true);
});

test("validateMemoryFile: bad input (null data) → returns ok:false with a single shape error", () => {
  const result = validateMemoryFile("state.json", null);
  assert.equal(result.ok, false);
  assert.ok(result.violations.find((v) => v.kind === "non_object_root"));
});
