"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SCHEME,
  assertSignerMatches,
  signProof,
  verifyProof
} = require("../src/agent/proof-signing");
const { canonicalize, payloadHash } = require("../src/agent/proof-canonical");

const KEY_A = "0x" + "11".repeat(32);
const KEY_B = "0x" + "22".repeat(32);
const ADDRESS_A = "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A";
const ADDRESS_B = "0x1563915e194D8CfBA1943570603F7606A3115508";

function baseProof(overrides = {}) {
  return {
    brand: "Orbit",
    cycle: 42,
    startedAt: "2026-05-23T04:07:34.518Z",
    finishedAt: "2026-05-23T04:07:35.378Z",
    trigger: { type: "mandatory", id: "regular_heartbeat" },
    dryRun: false,
    totalSteps: 3,
    steps: [
      { step: 1, content: "first" },
      { step: 2, content: "second" },
      { step: 3, content: "third" }
    ],
    filesChanged: ["memory/state.json"],
    result: "ok",
    ...overrides
  };
}

test("canonical hash is stable across key reordering", () => {
  const a = { a: 1, b: 2, c: [3, 4], d: { x: 1, y: 2 } };
  const b = { d: { y: 2, x: 1 }, c: [3, 4], b: 2, a: 1 };
  assert.equal(canonicalize(a), canonicalize(b));
  assert.equal(payloadHash(a), payloadHash(b));
});

test("payloadHash ignores envelope fields", () => {
  const proof = baseProof();
  const withoutEnvelope = payloadHash(proof);
  const withEnvelope = payloadHash({
    ...proof,
    signature: "0xabc",
    signer: "0x" + "ff".repeat(20),
    signedAt: "2026-05-23T04:07:35.379Z",
    signatureScheme: "anything",
    payloadHash: "0x00"
  });
  assert.equal(withoutEnvelope, withEnvelope);
});

test("signProof round-trips with verifyProof", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  assert.equal(envelope.signatureScheme, SCHEME);
  assert.equal(envelope.signer, ADDRESS_A);
  assert.match(envelope.signature, /^0x[0-9a-fA-F]{130}$/);
  assert.match(envelope.payloadHash, /^0x[0-9a-fA-F]{64}$/);

  const signed = { ...proof, ...envelope };
  const result = await verifyProof(signed);
  assert.equal(result.signed, true);
  assert.equal(result.verified, true);
  assert.equal(result.recovered, ADDRESS_A);
  assert.equal(result.signer, ADDRESS_A);
});

// Regression: cast is appended to the proof AFTER signing (see run.js
// farcaster block). It must NOT participate in the canonical body, or
// re-verification mid-pipeline would fail with a hash mismatch.
test("verifyProof accepts proofs with post-signing `cast` metadata", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const signed = { ...proof, ...envelope };
  // Simulate what farcaster.js does — attach cast metadata after signing.
  signed.cast = { ok: true, hash: "0xabc", kind: "milestone", idem: "deadbeef", blocked: false, dryRun: false, status: 200, ledgerPath: "memory/farcaster-casts.json" };
  const result = await verifyProof(signed);
  assert.equal(result.verified, true, `verification should ignore 'cast': ${JSON.stringify(result)}`);
});

test("verifyProof rejects payload tampering in steps", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const signed = { ...proof, ...envelope };
  signed.steps[0].content = "tampered";
  const result = await verifyProof(signed);
  assert.equal(result.verified, false);
  assert.equal(result.reason, "payload_hash_mismatch");
});

test("verifyProof rejects typed-message field tampering", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const signed = { ...proof, ...envelope };
  signed.cycle = signed.cycle + 1;
  const result = await verifyProof(signed);
  assert.equal(result.verified, false);
  assert.ok(
    result.reason === "payload_hash_mismatch" || result.reason === "recovered_address_mismatch",
    `expected payload or recovered mismatch, got ${result.reason}`
  );
});

test("verifyProof rejects wrong declared signer", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const signed = { ...proof, ...envelope, signer: ADDRESS_B };
  const result = await verifyProof(signed);
  assert.equal(result.verified, false);
  assert.equal(result.reason, "recovered_address_mismatch");
});

test("verifyProof rejects mismatched expectedSigner option", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const signed = { ...proof, ...envelope };
  const result = await verifyProof(signed, { expectedSigner: ADDRESS_B });
  assert.equal(result.verified, false);
  assert.equal(result.reason, "expected_signer_mismatch");
});

test("verifyProof accepts matching expectedSigner option (any case)", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const signed = { ...proof, ...envelope };
  const result = await verifyProof(signed, { expectedSigner: ADDRESS_A.toLowerCase() });
  assert.equal(result.verified, true);
});

test("verifyProof returns unsigned for missing signature fields", async () => {
  const result = await verifyProof(baseProof());
  assert.equal(result.signed, false);
  assert.equal(result.verified, false);
  assert.equal(result.reason, "not_signed");
});

test("verifyProof returns unknown_scheme for future versions", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const signed = { ...proof, ...envelope, signatureScheme: "eip712:orbit-cycle-proof/2" };
  const result = await verifyProof(signed);
  assert.equal(result.signed, true);
  assert.equal(result.verified, false);
  assert.equal(result.reason, "unknown_scheme");
});

test("assertSignerMatches: derived address must equal expected", () => {
  assert.equal(assertSignerMatches(KEY_A, ADDRESS_A), ADDRESS_A);
  assert.throws(() => assertSignerMatches(KEY_A, ADDRESS_B), /signer mismatch/);
  assert.throws(() => assertSignerMatches(KEY_B, ADDRESS_A), /signer mismatch/);
  assert.throws(() => assertSignerMatches(KEY_A, "not-an-address"), /not a valid address/);
});

test("assertSignerMatches: address case-insensitive", () => {
  const lower = ADDRESS_A.toLowerCase();
  assert.equal(assertSignerMatches(KEY_A, lower), ADDRESS_A);
});

test("two independent keys produce different signers", async () => {
  const proof = baseProof();
  const fromA = await signProof(proof, KEY_A);
  const fromB = await signProof(proof, KEY_B);
  assert.equal(fromA.signer, ADDRESS_A);
  assert.equal(fromB.signer, ADDRESS_B);
  assert.notEqual(fromA.signature, fromB.signature);
});
