"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  CANONICAL_FIXTURE_IDS,
  validateManifest,
  validateOutput
} = require("../packages/issue-scam-scanner/calibration-validator");

const lanes = ["clear", "low", "medium", "high", "critical", "critical", "clear"];

function validManifest() {
  return CANONICAL_FIXTURE_IDS.map((fixtureId, index) => ({
    fixtureId,
    expectedLane: lanes[index],
    sourceRef: `tests/fixtures/${fixtureId}.txt`,
    expectedCategories: []
  }));
}

function validOutput() {
  return CANONICAL_FIXTURE_IDS.map((fixtureId, index) => ({
    fixtureId,
    expectedLane: lanes[index],
    actualLane: lanes[index],
    match: true,
    categories: [],
    decision: "keep"
  }));
}

describe("calibration validator", () => {
  it("accepts the exact canonical manifest", () => {
    assert.deepEqual(validateManifest(validManifest()), { valid: true, errors: [] });
  });

  it("rejects missing, duplicate, unknown, and unsafe manifest values without echoing them", () => {
    const manifest = validManifest();
    manifest.pop();
    manifest[1] = { ...manifest[0] };
    manifest[2] = { ...manifest[2], fixtureId: "unknown-fixture" };
    manifest[3] = { ...manifest[3], expectedLane: "unknown-lane" };
    manifest[4] = { ...manifest[4], expectedCategories: ["unknown-category"] };
    manifest[5] = { ...manifest[5], sourceRef: "https://example.invalid/fixture" };

    const result = validateManifest(manifest);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((item) => item.errorClass === "incomplete_run"));
    assert.ok(result.errors.some((item) => item.field === "sourceRef"));
    assert.equal(JSON.stringify(result).includes("example.invalid"), false);
    assert.equal(JSON.stringify(result).includes("unknown-category"), false);
  });

  it("rejects absolute and traversing source references", () => {
    for (const sourceRef of ["../fixture.txt", "/tmp/fixture.txt", "C:\\temp\\fixture.txt"]) {
      const manifest = validManifest();
      manifest[0] = { ...manifest[0], sourceRef };
      assert.equal(validateManifest(manifest).valid, false);
    }
  });

  it("accepts canonical public-safe output", () => {
    assert.deepEqual(validateOutput(validOutput()), { valid: true, errors: [] });
  });

  it("accepts a completed lane mismatch only with hold", () => {
    const records = validOutput();
    records[1] = { ...records[1], actualLane: "medium", match: false, decision: "hold" };
    assert.equal(validateOutput(records).valid, true);
  });

  it("rejects extra fields, wrong order, inconsistent match, and fabricated failure success", () => {
    const records = validOutput();
    records[0] = { ...records[0], rawBody: "must-not-pass" };
    [records[1], records[2]] = [records[2], records[1]];
    records[3] = { ...records[3], actualLane: "low" };
    records[4] = { ...records[4], errorClass: "scanner_failure" };

    const result = validateOutput(records);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((item) => item.field === "record"));
    assert.ok(result.errors.some((item) => item.field === "order"));
    assert.ok(result.errors.some((item) => item.field === "match"));
    assert.ok(result.errors.some((item) => item.field === "errorClass"));
    assert.equal(JSON.stringify(result).includes("must-not-pass"), false);
  });
});
