"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { signProof } = require("../src/agent/proof-signing");
const { verifyProofFile } = require("../packages/orbit-verifier");

const CLI = path.resolve(__dirname, "..", "packages", "orbit-verifier", "cli.js");

const KEY_A = "0x" + "11".repeat(32);
const KEY_B = "0x" + "22".repeat(32);
const ADDRESS_A = "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A";
const ADDRESS_B = "0x1563915e194D8CfBA1943570603F7606A3115508";

function baseProof(overrides = {}) {
  return {
    brand: "Orbit",
    cycle: 7,
    startedAt: "2026-05-23T04:07:34.518Z",
    finishedAt: "2026-05-23T04:07:35.378Z",
    trigger: { type: "schedule", id: "regular_heartbeat" },
    dryRun: false,
    totalSteps: 1,
    steps: [{ step: 1, content: "hello" }],
    filesChanged: [],
    result: "ok",
    ...overrides
  };
}

function makeTempFile(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-verifier-"));
  const filePath = path.join(dir, "proof.json");
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function runCli(args = []) {
  try {
    const stdout = execFileSync("node", [CLI, ...args], { encoding: "utf8" });
    return { code: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      code: typeof error.status === "number" ? error.status : 1,
      stdout: String(error.stdout || ""),
      stderr: String(error.stderr || "")
    };
  }
}

test("verifyProofFile round-trip", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const signed = { ...proof, ...envelope };
  const result = await verifyProofFile(signed);
  assert.equal(result.verified, true);
  assert.equal(result.recovered, ADDRESS_A);
});

test("CLI exit 0 for verified proof", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const file = makeTempFile(JSON.stringify({ ...proof, ...envelope }));
  const result = runCli([file]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /OK/);
});

test("CLI exit 2 for unsigned proof", () => {
  const file = makeTempFile(JSON.stringify(baseProof()));
  const result = runCli([file]);
  assert.equal(result.code, 2);
  assert.match(result.stdout, /UNSIGNED/);
});

test("CLI exit 1 for tampered proof", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const tampered = { ...proof, ...envelope };
  tampered.steps[0].content = "evil";
  const file = makeTempFile(JSON.stringify(tampered));
  const result = runCli([file]);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /INVALID/);
});

test("CLI exit 1 when --signer mismatches", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const file = makeTempFile(JSON.stringify({ ...proof, ...envelope }));
  const result = runCli([file, "--signer", ADDRESS_B]);
  assert.equal(result.code, 1);
});

test("CLI exit 0 when --signer matches", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const file = makeTempFile(JSON.stringify({ ...proof, ...envelope }));
  const result = runCli([file, "--signer", ADDRESS_A]);
  assert.equal(result.code, 0);
});

test("CLI exit 3 for usage errors", () => {
  const noArgs = runCli([]);
  assert.equal(noArgs.code, 3);
  const unknownFlag = runCli(["--bogus", "file.json"]);
  assert.equal(unknownFlag.code, 3);
});

test("CLI exit 4 for missing or malformed file", () => {
  const missing = runCli(["/tmp/does-not-exist-orbit-verifier.json"]);
  assert.equal(missing.code, 4);

  const bad = makeTempFile("not json {");
  const bogus = runCli([bad]);
  assert.equal(bogus.code, 4);
});

test("CLI --json emits structured output", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_A);
  const file = makeTempFile(JSON.stringify({ ...proof, ...envelope }));
  const result = runCli([file, "--json"]);
  assert.equal(result.code, 0);
  const lines = result.stdout.trim().split("\n");
  const record = JSON.parse(lines[0]);
  assert.equal(record.verified, true);
  assert.equal(record.recovered, ADDRESS_A);
  assert.equal(record.signatureScheme, "eip712:orbit-cycle-proof/1");
});

test("CLI surfaces unknown_scheme as INVALID", async () => {
  const proof = baseProof();
  const envelope = await signProof(proof, KEY_B);
  const file = makeTempFile(JSON.stringify({
    ...proof,
    ...envelope,
    signatureScheme: "eip712:orbit-cycle-proof/2"
  }));
  const result = runCli([file]);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /unknown_scheme/);
});
