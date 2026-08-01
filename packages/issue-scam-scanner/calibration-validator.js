"use strict";

const path = require("node:path");

const CANONICAL_FIXTURE_IDS = Object.freeze([
  "benign-maintenance-001",
  "mild-urgency-001",
  "obfuscated-relay-001",
  "wallet-risk-001",
  "credential-risk-001",
  "fake-support-001",
  "scanner-failure-001"
]);

const ALLOWED_LANES = new Set(["clear", "low", "medium", "high", "critical"]);
const ALLOWED_CATEGORIES = new Set([
  "credential_phish",
  "drain_phrase",
  "encoded_instruction_relay",
  "external_wallet",
  "fake_support",
  "fund_transfer",
  "malformed_url",
  "obfuscation",
  "prompt_injection",
  "reward_claim",
  "secret_request",
  "shortened_url",
  "unicode_url",
  "unknown_financial_domain",
  "urgent_pressure"
]);
const ALLOWED_ERROR_CLASSES = new Set([
  "input_invalid",
  "fixture_missing",
  "scanner_failure",
  "output_invalid",
  "incomplete_run"
]);
const INPUT_KEYS = new Set(["fixtureId", "expectedLane", "sourceRef", "expectedCategories"]);
const OUTPUT_KEYS = new Set([
  "fixtureId",
  "expectedLane",
  "actualLane",
  "match",
  "categories",
  "decision",
  "errorClass"
]);

function error(errorClass, field, fixtureId) {
  const item = { errorClass };
  if (field) item.field = field;
  if (CANONICAL_FIXTURE_IDS.includes(fixtureId)) item.fixtureId = fixtureId;
  return item;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(record, allowed) {
  return Object.keys(record).every((key) => allowed.has(key));
}

function isUniqueAllowedList(value, allowed) {
  return Array.isArray(value)
    && new Set(value).size === value.length
    && value.every((item) => typeof item === "string" && allowed.has(item));
}

function isSafeSourceRef(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) return false;
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || value.includes("\\")) return false;
  return !value.split("/").includes("..");
}

function validateManifest(manifest) {
  const errors = [];
  if (!Array.isArray(manifest)) return { valid: false, errors: [error("input_invalid", "manifest")] };
  if (manifest.length !== CANONICAL_FIXTURE_IDS.length) {
    errors.push(error("incomplete_run", "manifest"));
  }

  const seen = new Set();
  for (const record of manifest) {
    if (!isPlainObject(record)) {
      errors.push(error("input_invalid", "record"));
      continue;
    }

    const fixtureId = record.fixtureId;
    if (!hasOnlyKeys(record, INPUT_KEYS)) errors.push(error("input_invalid", "record", fixtureId));
    if (!CANONICAL_FIXTURE_IDS.includes(fixtureId)) {
      errors.push(error("input_invalid", "fixtureId"));
    } else if (seen.has(fixtureId)) {
      errors.push(error("input_invalid", "fixtureId", fixtureId));
    } else {
      seen.add(fixtureId);
    }

    if (!ALLOWED_LANES.has(record.expectedLane)) {
      errors.push(error("input_invalid", "expectedLane", fixtureId));
    }
    if (!isSafeSourceRef(record.sourceRef)) {
      errors.push(error("input_invalid", "sourceRef", fixtureId));
    }
    if (!isUniqueAllowedList(record.expectedCategories, ALLOWED_CATEGORIES)) {
      errors.push(error("input_invalid", "expectedCategories", fixtureId));
    }
  }

  if (seen.size !== CANONICAL_FIXTURE_IDS.length) {
    errors.push(error("incomplete_run", "fixtureId"));
  }
  return { valid: errors.length === 0, errors };
}

function validateOutput(records) {
  const errors = [];
  if (!Array.isArray(records)) return { valid: false, errors: [error("output_invalid", "records")] };
  if (records.length !== CANONICAL_FIXTURE_IDS.length) {
    errors.push(error("incomplete_run", "records"));
  }

  const seen = new Set();
  records.forEach((record, index) => {
    if (!isPlainObject(record)) {
      errors.push(error("output_invalid", "record"));
      return;
    }

    const fixtureId = record.fixtureId;
    if (!hasOnlyKeys(record, OUTPUT_KEYS)) errors.push(error("output_invalid", "record", fixtureId));
    if (!CANONICAL_FIXTURE_IDS.includes(fixtureId)) {
      errors.push(error("output_invalid", "fixtureId"));
    } else {
      if (seen.has(fixtureId)) errors.push(error("output_invalid", "fixtureId", fixtureId));
      seen.add(fixtureId);
      if (CANONICAL_FIXTURE_IDS[index] !== fixtureId) {
        errors.push(error("output_invalid", "order", fixtureId));
      }
    }

    if (!ALLOWED_LANES.has(record.expectedLane)) errors.push(error("output_invalid", "expectedLane", fixtureId));
    if (!ALLOWED_LANES.has(record.actualLane)) errors.push(error("output_invalid", "actualLane", fixtureId));
    if (typeof record.match !== "boolean") errors.push(error("output_invalid", "match", fixtureId));
    if (!isUniqueAllowedList(record.categories, ALLOWED_CATEGORIES)) {
      errors.push(error("output_invalid", "categories", fixtureId));
    }
    if (record.decision !== "keep" && record.decision !== "hold") {
      errors.push(error("output_invalid", "decision", fixtureId));
    }
    if (record.errorClass !== undefined && !ALLOWED_ERROR_CLASSES.has(record.errorClass)) {
      errors.push(error("output_invalid", "errorClass", fixtureId));
    }

    const lanesMatch = ALLOWED_LANES.has(record.expectedLane)
      && ALLOWED_LANES.has(record.actualLane)
      && record.expectedLane === record.actualLane;
    if (typeof record.match === "boolean" && record.match !== lanesMatch) {
      errors.push(error("output_invalid", "match", fixtureId));
    }
    if (record.errorClass !== undefined && (record.match !== false || record.decision !== "hold")) {
      errors.push(error("output_invalid", "errorClass", fixtureId));
    } else if (record.errorClass === undefined && typeof record.match === "boolean") {
      const expectedDecision = record.match ? "keep" : "hold";
      if (record.decision !== expectedDecision) errors.push(error("output_invalid", "decision", fixtureId));
    }
  });

  if (seen.size !== CANONICAL_FIXTURE_IDS.length) {
    errors.push(error("incomplete_run", "fixtureId"));
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  CANONICAL_FIXTURE_IDS,
  validateManifest,
  validateOutput
};
