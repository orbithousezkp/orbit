"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  replayCycleProof,
  crossCheckClaims,
  buildReplayReport
} = require("../src/agent/cycle-replay");

// F-1.2 (PLAN/ROADMAP_EXPANSION.md): cycle-rerun forensics.
// LLM calls are non-deterministic — true replay is impossible. The
// forensics layer verifies a recorded proof is self-consistent:
//   - cycle number is a non-negative integer
//   - timestamp is a parseable ISO date
//   - required arrays exist with correct shapes
//   - actions claim vs filesChanged claim are coherent
//   - signer / signature shape is intact if present

function sampleProof() {
  return {
    cycle: 40,
    timestamp: "2026-05-24T06:13:05.010Z",
    trigger: { type: "mandatory", id: "regular_heartbeat" },
    actions: ["edited foo.md"],
    filesChanged: ["foo.md", "memory/state.json"],
    decisions: ["chose A over B"],
    refusals: []
  };
}

test("replayCycleProof: well-formed proof → ok with no drifts", () => {
  const result = replayCycleProof(sampleProof());
  assert.equal(result.ok, true);
  assert.deepEqual(result.drifts, []);
});

test("replayCycleProof: missing cycle field → drift kind=missing_field", () => {
  const proof = sampleProof();
  delete proof.cycle;
  const result = replayCycleProof(proof);
  assert.equal(result.ok, false);
  const d = result.drifts.find((x) => x.kind === "missing_field" && x.field === "cycle");
  assert.ok(d);
});

test("replayCycleProof: negative cycle → drift kind=invalid_cycle", () => {
  const proof = { ...sampleProof(), cycle: -1 };
  const result = replayCycleProof(proof);
  assert.equal(result.ok, false);
  const d = result.drifts.find((x) => x.kind === "invalid_cycle");
  assert.ok(d);
});

test("replayCycleProof: unparseable timestamp → drift kind=invalid_timestamp", () => {
  const proof = { ...sampleProof(), timestamp: "not-a-date" };
  const result = replayCycleProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.drifts.find((d) => d.kind === "invalid_timestamp"));
});

test("replayCycleProof: filesChanged is not an array → drift kind=type_mismatch", () => {
  const proof = { ...sampleProof(), filesChanged: "not-an-array" };
  const result = replayCycleProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.drifts.find((d) => d.kind === "type_mismatch" && d.field === "filesChanged"));
});

test("replayCycleProof: actions non-empty + filesChanged empty → drift kind=actions_without_files", () => {
  const proof = { ...sampleProof(), actions: ["did something"], filesChanged: [] };
  const result = replayCycleProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.drifts.find((d) => d.kind === "actions_without_files"));
});

test("replayCycleProof: filesChanged non-empty + actions empty → drift kind=files_without_actions", () => {
  const proof = { ...sampleProof(), actions: [], filesChanged: ["foo.md"] };
  const result = replayCycleProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.drifts.find((d) => d.kind === "files_without_actions"));
});

test("replayCycleProof: signature present but signer missing → drift kind=signature_no_signer", () => {
  const proof = { ...sampleProof(), signature: "0xdeadbeef" };
  const result = replayCycleProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.drifts.find((d) => d.kind === "signature_no_signer"));
});

test("replayCycleProof: signer present but signature missing → drift kind=signer_no_signature", () => {
  const proof = { ...sampleProof(), signer: "0xabc1234567890123456789012345678901234567" };
  const result = replayCycleProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.drifts.find((d) => d.kind === "signer_no_signature"));
});

test("replayCycleProof: both signer + signature present → no signature-shape drift", () => {
  const proof = {
    ...sampleProof(),
    signer: "0xabc1234567890123456789012345678901234567",
    signature: "0xdeadbeefdeadbeef"
  };
  const result = replayCycleProof(proof);
  assert.equal(result.ok, true);
});

test("crossCheckClaims: cycle-N state.json change matches a cycle-N proof", () => {
  const proof = sampleProof();
  const result = crossCheckClaims(proof);
  // state.json appears in filesChanged → expected for any cycle
  assert.equal(result.ok, true);
});

test("crossCheckClaims: claims-touching state.json but no decisions or actions → drift", () => {
  const proof = {
    cycle: 1,
    timestamp: "2026-05-28T00:00:00Z",
    trigger: { type: "mandatory" },
    actions: [],
    filesChanged: ["memory/state.json"],
    decisions: [],
    refusals: []
  };
  const result = crossCheckClaims(proof);
  assert.equal(result.ok, false);
  assert.ok(result.drifts.find((d) => d.kind === "state_change_no_record"));
});

test("buildReplayReport: rolls up replay + cross-check into one report", () => {
  const proof = sampleProof();
  const report = buildReplayReport(proof);
  assert.equal(report.ok, true);
  assert.equal(report.cycle, 40);
  assert.equal(report.timestamp, "2026-05-24T06:13:05.010Z");
  assert.deepEqual(report.drifts, []);
});

test("buildReplayReport: bad proof rolls up all drifts", () => {
  const proof = { /* empty */ };
  const report = buildReplayReport(proof);
  assert.equal(report.ok, false);
  // Has at least: missing cycle, missing timestamp, missing trigger
  assert.ok(report.drifts.length >= 3);
});

test("replayCycleProof: null/non-object input → drift kind=non_object_root", () => {
  assert.equal(replayCycleProof(null).ok, false);
  assert.equal(replayCycleProof("string").ok, false);
  assert.equal(replayCycleProof([]).ok, false);
  const r = replayCycleProof(null);
  assert.ok(r.drifts.find((d) => d.kind === "non_object_root"));
});

test("replayCycleProof: tolerates new-shape proofs (steps[] in place of actions)", () => {
  // New-shape proofs (from recent commits) use steps[] instead of actions[].
  // Replay accepts either — looking for actions OR steps as the activity record.
  const newShape = {
    brand: "Orbit",
    cycle: 53,
    startedAt: "2026-05-25T04:51:08.537Z",
    trigger: { type: "mandatory" },
    steps: [{ step: 1, accounting: "ai_usage" }],
    filesChanged: ["memory/state.json"]
  };
  const result = replayCycleProof(newShape);
  assert.equal(result.ok, true);
});
