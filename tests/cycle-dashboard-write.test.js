"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { writeDashboardSnapshot } = require("../src/agent/run");
const { projectForDashboard, exportBundle } = require("../packages/orbit-sdk");

function writeJson(repoRoot, relativePath, value) {
  const full = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`);
}

function makeSignedProof(overrides = {}) {
  return {
    cycle: 27,
    startedAt: "2026-05-24T00:00:00.000Z",
    finishedAt: "2026-05-24T00:01:00.000Z",
    trigger: { type: "schedule", id: "regular_heartbeat" },
    filesChanged: ["memory/state.json"],
    result: "cycle complete",
    totalSteps: 1,
    signature: "0x" + "a".repeat(130),
    signer: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
    signatureScheme: "eip712:orbit-cycle-proof/1",
    payloadHash: "0x" + "b".repeat(64),
    ...overrides
  };
}

function seedRepo(repoRoot) {
  writeJson(repoRoot, "memory/infrastructure.json", {
    product: { name: "Orbit", category: "GitHub-native agent infrastructure" },
    activePhase: { id: "phase-1", name: "Launch", status: "active" },
    blockedUntilApproved: ["Live wallet signing"]
  });
  writeJson(repoRoot, "memory/state.json", {
    cycle: 27,
    born: "2026-05-22T00:00:00.000Z",
    lastActive: "2026-05-24T00:00:00.000Z",
    lastStatus: "completed",
    firstWakeIntroComplete: true
  });
  writeJson(repoRoot, "memory/governance.json", {
    externalSpend: {
      mode: "owner_approval_required",
      allowedWithoutApproval: ["gas", "ai_call"]
    }
  });
  writeJson(repoRoot, "memory/treasury.json", {
    token: { name: "Orbit", symbol: "ORBIT", launchStatus: "planned" }
  });
  fs.writeFileSync(
    path.join(repoRoot, "memory/cycles.jsonl"),
    `${JSON.stringify({ cycle: 27, timestamp: "2026-05-24T00:00:00.000Z", result: "ok" })}\n`
  );
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeSignedProof());
}

function tempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-dash-write-"));
  seedRepo(repoRoot);
  return repoRoot;
}

test("projectForDashboard JSON has expected top-level keys", () => {
  const repoRoot = tempRepo();
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10, includeMemory: false });
  const slim = projectForDashboard(bundle, { gitCommit: "abc1234" });
  const parsed = JSON.parse(JSON.stringify(slim));
  for (const key of ["schema", "generatedAt", "gitCommit", "lifecycle", "walletPolicy", "permissions", "receipts", "digest"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(parsed, key), `missing top-level key: ${key}`);
  }
  assert.equal(parsed.schema, "orbit-dashboard/1");
});

test("writeDashboardSnapshot writes public/dashboard.json when public/ does not exist", () => {
  const repoRoot = tempRepo();
  assert.equal(fs.existsSync(path.join(repoRoot, "public")), false);

  const result = writeDashboardSnapshot({ repoRoot });
  assert.equal(result.written, true);
  assert.equal(result.path, "public/dashboard.json");

  const full = path.join(repoRoot, "public/dashboard.json");
  assert.equal(fs.existsSync(full), true);
  const text = fs.readFileSync(full, "utf-8");
  const parsed = JSON.parse(text);
  assert.equal(parsed.schema, "orbit-dashboard/1");
  assert.equal(parsed.lifecycle.cycle, 27);
});

test("writeDashboardSnapshot tolerates non-git repo and sets gitCommit null", () => {
  const repoRoot = tempRepo();
  assert.equal(fs.existsSync(path.join(repoRoot, ".git")), false);

  const result = writeDashboardSnapshot({ repoRoot });
  assert.equal(result.written, true);

  const parsed = JSON.parse(fs.readFileSync(path.join(repoRoot, "public/dashboard.json"), "utf-8"));
  assert.equal(parsed.gitCommit, null);
});

test("writeDashboardSnapshot output stays under 60KB cap", () => {
  const repoRoot = tempRepo();
  for (let i = 0; i < 14; i += 1) {
    writeJson(repoRoot, `runtime/proofs/2026-05-24/${String(i).padStart(2, "0")}.json`, makeSignedProof({
      cycle: 10 + i,
      result: "cycle complete with detail ".repeat(8),
      filesChanged: ["memory/state.json", "memory/cycles.jsonl", "memory/treasury.json"]
    }));
  }

  const result = writeDashboardSnapshot({ repoRoot });
  assert.equal(result.written, true);
  assert.ok(result.bytes <= 60_000, `dashboard bytes ${result.bytes} exceeded 60KB`);
  const bytesOnDisk = fs.statSync(path.join(repoRoot, "public/dashboard.json")).size;
  assert.ok(bytesOnDisk <= 60_500, `file on disk ${bytesOnDisk} exceeded ~60KB`);
});
