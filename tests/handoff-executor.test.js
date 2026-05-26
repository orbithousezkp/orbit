"use strict";

// Tests for the founder-handoff executor (Patch Set V).
//
// The executor's job is to produce a per-handoff completion bundle —
// the artifact a maintainer needs to actually land the change.
// The on-chain part is deliberately NOT signed from CI; the bundle
// is the hand-off surface, not a silent action.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  ADD_OWNER_WITH_THRESHOLD_SELECTOR,
  buildBundle,
  buildSignerRotationBundle,
  buildMaintainerListChangeBundle,
  buildPrivilegeReductionBundle,
  encodeAddOwnerWithThreshold,
  makeExecutor
} = require("../src/agent/handoff-executor");

function tempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "orbit-exec-test-"));
}

const NEW_OWNER = "0x1111111111111111111111111111111111111111";
const SAFE_ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function signerHandoff(overrides = {}) {
  return {
    id: "h-001",
    type: "signer-rotation",
    from: "alice",
    to: NEW_OWNER,
    rationale: "founder-fade step 1",
    ...overrides
  };
}

test("encodeAddOwnerWithThreshold matches the gnosis safe ABI shape", () => {
  const data = encodeAddOwnerWithThreshold(NEW_OWNER, 2);
  // 4-byte selector + 32-byte address + 32-byte uint = 0x + 8 + 64 + 64 chars.
  assert.equal(data.length, 2 + 8 + 64 + 64);
  assert.ok(data.startsWith(ADD_OWNER_WITH_THRESHOLD_SELECTOR));
  // Address: zero-padded to 32 bytes (left-padded), lowercased.
  const addrSlot = data.slice(2 + 8, 2 + 8 + 64);
  assert.equal(addrSlot, "0".repeat(24) + NEW_OWNER.slice(2).toLowerCase());
  // Threshold: zero-padded to 32 bytes; "2" -> 0x02 at the rightmost byte.
  const thresholdSlot = data.slice(2 + 8 + 64);
  assert.equal(thresholdSlot, "0".repeat(63) + "2");
});

test("encodeAddOwnerWithThreshold rejects non-EVM addresses", () => {
  assert.throws(() => encodeAddOwnerWithThreshold("alice", 1), /not a valid EVM address/);
  assert.throws(() => encodeAddOwnerWithThreshold("0xshort", 1), /not a valid EVM address/);
});

test("buildSignerRotationBundle requires safeAddress and a 0x to-address", () => {
  assert.throws(
    () => buildSignerRotationBundle(signerHandoff(), {}),
    /safeAddress required/
  );
  assert.throws(
    () => buildSignerRotationBundle(signerHandoff({ to: "alice" }), { safeAddress: SAFE_ADDR }),
    /handoff\.to must be an EVM address/
  );
});

test("buildSignerRotationBundle threshold defaults to 1, refuses 0 or negative", () => {
  const bundle = buildSignerRotationBundle(signerHandoff(), { safeAddress: SAFE_ADDR });
  assert.equal(bundle.arguments.threshold, 1);
  assert.throws(
    () => buildSignerRotationBundle(signerHandoff(), { safeAddress: SAFE_ADDR, threshold: 0 }),
    /threshold must be >= 1/
  );
});

test("buildSignerRotationBundle bundle shape contains txTo / txData / instructions", () => {
  const bundle = buildSignerRotationBundle(signerHandoff(), { safeAddress: SAFE_ADDR, threshold: 2 });
  assert.equal(bundle.kind, "signer-rotation");
  assert.equal(bundle.txTo, SAFE_ADDR);
  assert.equal(bundle.txValue, "0");
  assert.ok(bundle.txData.startsWith(ADD_OWNER_WITH_THRESHOLD_SELECTOR));
  assert.equal(bundle.arguments.newOwner, NEW_OWNER);
  assert.equal(bundle.arguments.threshold, 2);
  assert.ok(Array.isArray(bundle.instructions) && bundle.instructions.length >= 4);
});

test("buildMaintainerListChangeBundle parses to as a comma-separated GitHub-handle list", () => {
  const bundle = buildMaintainerListChangeBundle({
    id: "h-002",
    type: "maintainer-list-change",
    to: "alice, bob, carol"
  });
  assert.deepEqual(bundle.newMaintainers, ["alice", "bob", "carol"]);
  assert.ok(bundle.ghCommand.includes("ORBIT_MAINTAINERS"));
  assert.ok(bundle.ghCommand.includes("alice,bob,carol"));
});

test("buildMaintainerListChangeBundle rejects an empty list", () => {
  assert.throws(
    () => buildMaintainerListChangeBundle({ id: "h-002", type: "maintainer-list-change", to: "" }),
    /non-empty comma list/
  );
});

test("buildPrivilegeReductionBundle passes rationale through and gives owner instructions", () => {
  const bundle = buildPrivilegeReductionBundle({
    id: "h-003",
    type: "privilege-reduction",
    rationale: "tighten externalSpend.allowedWithoutApproval"
  });
  assert.equal(bundle.kind, "privilege-reduction");
  assert.match(bundle.description, /tighten/);
  assert.ok(Array.isArray(bundle.instructions) && bundle.instructions.length >= 3);
});

test("buildBundle dispatches by handoff.type and throws on unknown", () => {
  assert.equal(buildBundle(signerHandoff(), { safeAddress: SAFE_ADDR }).kind, "signer-rotation");
  assert.equal(
    buildBundle({ id: "x", type: "maintainer-list-change", to: "a,b" }).kind,
    "maintainer-list-change"
  );
  assert.equal(
    buildBundle({ id: "x", type: "privilege-reduction", rationale: "r" }).kind,
    "privilege-reduction"
  );
  assert.throws(
    () => buildBundle({ id: "x", type: "unknown-future-type" }),
    /unknown handoff\.type/
  );
});

test("makeExecutor writes a JSON bundle to runtime/handoff/ and returns its relative path", async () => {
  const repoRoot = tempRepo();
  const executor = makeExecutor(repoRoot, { safeAddress: SAFE_ADDR, threshold: 1 });
  const result = await executor(signerHandoff());
  assert.equal(result.kind, "signer-rotation");
  assert.equal(result.requiresOwnerAction, true);
  assert.equal(result.bundlePath, "runtime/handoff/bundle-h-001.json");

  const onDisk = JSON.parse(fs.readFileSync(path.join(repoRoot, result.bundlePath), "utf-8"));
  assert.equal(onDisk.handoffId, "h-001");
  assert.equal(onDisk.handoffType, "signer-rotation");
  assert.equal(onDisk.safeAddress, SAFE_ADDR);
  assert.ok(onDisk.txData.startsWith(ADD_OWNER_WITH_THRESHOLD_SELECTOR));
  assert.ok(typeof onDisk.builtAt === "string");
});

test("makeExecutor writes atomically (no .tmp leftover after success)", async () => {
  const repoRoot = tempRepo();
  const executor = makeExecutor(repoRoot, { safeAddress: SAFE_ADDR, threshold: 1 });
  await executor(signerHandoff());
  const entries = fs.readdirSync(path.join(repoRoot, "runtime/handoff"));
  assert.deepEqual(entries.filter((n) => n.includes(".tmp")), []);
});

test("makeExecutor + handoff.tickHandoffs together advance an expired TIMELOCK to COMPLETE", async () => {
  // End-to-end: the executor injected into tickHandoffs is what
  // makes the lifecycle advance past EXECUTING. Without this wiring,
  // tickHandoffs leaves the proposal stuck in EXECUTING with the
  // "executing-no-executor" marker.
  const handoff = require("../src/agent/handoff");
  const repoRoot = tempRepo();
  // Set up: a TIMELOCK proposal whose timer has already expired.
  fs.mkdirSync(path.join(repoRoot, "memory"), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, "memory/handoff.json"),
    JSON.stringify({
      schema: "orbit-handoff/1",
      handoffs: [{
        id: "h-001",
        idemKey: "test-key",
        type: "signer-rotation",
        from: "alice",
        to: NEW_OWNER,
        rationale: "test",
        status: "timelock",
        approvals: ["alice", "bob"],
        rejections: [],
        extensions: 0,
        createdAt: "2026-06-01T00:00:00Z",
        quorumReachedAt: "2026-06-01T00:00:00Z",
        timelockEndsAt: "2026-06-02T00:00:00Z",      // long expired
        history: []
      }]
    })
  );
  const executor = makeExecutor(repoRoot, { safeAddress: SAFE_ADDR, threshold: 1 });
  const result = await handoff.tickHandoffs(repoRoot, {
    now: new Date("2026-07-01T00:00:00Z"),
    executor
  });
  assert.equal(result.advanced.length, 1);
  assert.equal(result.advanced[0].status, "complete");
  const stored = handoff.listHandoffs(repoRoot)[0];
  assert.equal(stored.status, "complete");
  // The executor outcome is recorded in history.
  const hasOutcome = stored.history.some((h) => h.transition === "complete" && h.outcome);
  assert.equal(hasOutcome, true);
  // Bundle file landed.
  assert.equal(fs.existsSync(path.join(repoRoot, "runtime/handoff/bundle-h-001.json")), true);
});
