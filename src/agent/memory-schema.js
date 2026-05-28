"use strict";

// F-1.6 (PLAN/ROADMAP_EXPANSION.md): pluggable JSON schema validators per
// memory/*.json file.
//
// Design: light, no jsonschema dep. Each schema is a plain JS object:
//   {
//     required: { keyName: "type", ... },
//     optional: { keyName: "type", ... }
//   }
// Supported types: "string" | "number" | "integer" | "boolean" | "object"
// | "array" | "null". "object" rejects arrays and null (so the caller can
// model "actual object" vs "array" distinctly).
//
// Pairs with src/agent/memory-scan.js (F-1.3). A scanner caller can do:
//   const reg = buildSchemaRegistry();
//   const r = scanMemoryIntegrity(repoRoot, { schemas: r });
// (current memory-scan only checks top-level key PRESENCE; this module
// adds type-shape checking. A follow-up sprint wires memory-scan to use
// validateMemoryFile() directly for full enforcement.)

// Canonical schemas for the in-tree memory files. These are intentionally
// MINIMAL — only the load-bearing fields that, if missing or the wrong
// type, would crash a cycle hard. Optional fields are left out (a future
// sprint can append them as schemas evolve, paired with an F-1.1 schema
// migration when shapes change).
const CANONICAL_MEMORY_SCHEMAS = Object.freeze({
  "state.json": Object.freeze({
    required: { cycle: "number" },
    optional: {
      born: "string",
      lastStatus: "string",
      schemaVersion: "integer",
      preLaunchVerified: "boolean",
      preLaunchVerifiedHash: "string",
      preLaunchVerifiedAt: "string",
      firstCleanCycle: "integer",
      lastCleanCycle: "integer",
      launchOnceFired: "boolean"
    }
  }),
  "governance.json": Object.freeze({
    required: {
      ownerUsername: "string",
      policyVersion: "integer"
    },
    optional: {
      externalSpend: "object",
      quorum: "object"
    }
  }),
  "treasury.json": Object.freeze({
    required: { ai: "object" },
    optional: {
      revenue: "object",
      token: "object"
    }
  })
});

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function typeMatches(expected, value) {
  const actual = typeOf(value);
  if (expected === "integer") return actual === "integer";
  // "number" accepts both integer and float.
  if (expected === "number") return actual === "number" || actual === "integer";
  if (expected === "array") return actual === "array";
  if (expected === "object") return actual === "object";
  if (expected === "null") return actual === "null";
  // string, boolean
  return actual === expected;
}

function validateMemoryShape(schema, data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      violations: [{ kind: "non_object_root", actual: typeOf(data) }]
    };
  }
  const violations = [];
  const required = (schema && schema.required) || {};
  const optional = (schema && schema.optional) || {};
  for (const [key, expectedType] of Object.entries(required)) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      violations.push({ kind: "missing_key", key });
      continue;
    }
    if (!typeMatches(expectedType, data[key])) {
      violations.push({
        kind: "type_mismatch",
        key,
        expected: expectedType,
        actual: typeOf(data[key])
      });
    }
  }
  for (const [key, expectedType] of Object.entries(optional)) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    if (!typeMatches(expectedType, data[key])) {
      violations.push({
        kind: "type_mismatch",
        key,
        expected: expectedType,
        actual: typeOf(data[key])
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

function buildSchemaRegistry(overrides) {
  const reg = { ...CANONICAL_MEMORY_SCHEMAS };
  if (overrides && typeof overrides === "object") {
    for (const [filename, schema] of Object.entries(overrides)) {
      reg[filename] = schema;
    }
  }
  return reg;
}

function registerSchema(registry, filename, schema) {
  if (!registry || typeof registry !== "object") {
    throw new Error("registerSchema requires a registry object");
  }
  if (typeof filename !== "string" || filename.length === 0) {
    throw new Error("filename must be a non-empty string");
  }
  registry[filename] = schema;
  return registry;
}

function validateMemoryFile(filename, data, registry) {
  const reg = registry || CANONICAL_MEMORY_SCHEMAS;
  const schema = reg[filename];
  if (!schema) {
    return { ok: true, violations: [], note: "no_schema_registered" };
  }
  return validateMemoryShape(schema, data);
}

module.exports = {
  CANONICAL_MEMORY_SCHEMAS,
  buildSchemaRegistry,
  registerSchema,
  validateMemoryFile,
  validateMemoryShape
};
