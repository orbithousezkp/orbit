"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { executeTool } = require("../src/agent/actions");
const {
  ANCHOR_LEDGER_PATH,
  ZERO_ROOT,
  anchorIdempotencyKey,
  buildMerkleTree,
  collectProofs,
  computeLeafHash,
  computeMerkleRoot,
  executeAnchor,
  generateProof,
  hashPair,
  isAnchorEnabled,
  loadAnchorLedger,
  proposeAnchor,
  verifyProof
} = require("../src/agent/merkle-anchor");
const { canonicalize, stripSignatureEnvelope } = require("../src/agent/proof-canonical");

const VALID_CONTRACT = "0x5555555555555555555555555555555555555555";

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-merkle-anchor-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "memory", "governance.json"),
    JSON.stringify({
      ownerUsername: "owner",
      policyVersion: 1,
      externalSpend: { mode: "owner_approval_required" }
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(dir, "memory", "approvals.json"),
    JSON.stringify({ approvals: [] }, null, 2)
  );
  return dir;
}

function baseConfig(repoRoot, overrides = {}) {
  return {
    repoRoot,
    ownerUsername: "owner",
    approvalIssueLabel: "orbit:approval",
    approvalAcceptedLabel: "orbit:approved",
    approvalRejectedLabel: "orbit:rejected",
    anchor: {
      enabled: true,
      dryRun: true,
      contractAddress: VALID_CONTRACT,
      windowHours: 24,
      approvalIssueLabel: "orbit:approval"
    },
    ...overrides
  };
}

function readyState(overrides = {}) {
  return {
    cycle: 42,
    preLaunchVerified: true,
    ...overrides
  };
}

function fakeGithub({ proposalIssueNumber = 31, labels = [], comments = [] } = {}) {
  return {
    created: [],
    labels: labels.slice(),
    comments: comments.slice(),
    proposalIssueNumber,
    async createIssue(issue) {
      this.created.push(issue);
      return {
        number: this.proposalIssueNumber,
        url: `https://example.com/${this.proposalIssueNumber}`,
        html_url: `https://github.com/example/${this.proposalIssueNumber}`
      };
    },
    async getIssue(number) {
      if (number !== this.proposalIssueNumber) return null;
      return { number, labels: this.labels.slice() };
    },
    async listIssueComments(number) {
      if (number !== this.proposalIssueNumber) return [];
      return this.comments.slice();
    }
  };
}

function writeProofFile(repoRoot, day, name, body) {
  const dir = path.join(repoRoot, "runtime", "proofs", day);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(body, null, 2));
}

function makeProof(cycle, isoTimestamp) {
  return {
    brand: "Orbit",
    cycle,
    startedAt: isoTimestamp,
    finishedAt: isoTimestamp,
    trigger: { type: "test", id: `t-${cycle}` },
    dryRun: false,
    totalSteps: 1,
    steps: [],
    filesChanged: []
  };
}

function fileNameForIso(iso) {
  // Mirror the writer in run.js: 2026-05-23T04:07:35.378Z -> 2026-05-23T04-07-35-378Z.json
  return `${iso.replace(/[:.]/g, "-").replace(/-(\d{3})-Z$/, "-$1Z")}.json`;
}

// --- leaf hashing --------------------------------------------------------

test("computeLeafHash is deterministic across runs", () => {
  const proof = makeProof(1, "2026-07-01T00:00:00.000Z");
  const a = computeLeafHash(proof);
  const b = computeLeafHash({ ...proof });
  assert.equal(a, b);
  assert.match(a, /^0x[0-9a-f]{64}$/);
});

test("computeLeafHash ignores signature envelope so re-signing is stable", () => {
  const proof = makeProof(2, "2026-07-01T00:01:00.000Z");
  const base = computeLeafHash(proof);
  const signed = {
    ...proof,
    signature: "0x" + "ab".repeat(65),
    signer: "0x4444444444444444444444444444444444444444",
    signedAt: "2026-07-01T00:01:01.000Z",
    signatureScheme: "eip712:orbit-cycle-proof/1",
    payloadHash: "0x" + "cd".repeat(32)
  };
  assert.equal(computeLeafHash(signed), base);
  // and the canonicalization confirms the envelope is stripped:
  const canonicalText = canonicalize(stripSignatureEnvelope(signed));
  const expected = "0x" + crypto.createHash("sha256").update(canonicalText, "utf-8").digest("hex");
  assert.equal(base, expected);
});

// --- tree shape ----------------------------------------------------------

test("buildMerkleTree(0) -> ZERO_ROOT and computeMerkleRoot([]) -> ZERO_ROOT", () => {
  const tree = buildMerkleTree([]);
  assert.equal(tree.root, ZERO_ROOT);
  assert.equal(tree.leafCount, 0);
  assert.equal(computeMerkleRoot([]), ZERO_ROOT);
});

test("buildMerkleTree produces correct root for 3-leaf input (odd duplicate)", () => {
  const a = "0x" + "11".repeat(32);
  const b = "0x" + "22".repeat(32);
  const c = "0x" + "33".repeat(32);
  const tree = buildMerkleTree([a, b, c]);
  // layer 1: pair(a,b), pair(c,c)
  const ab = hashPair(a, b);
  const cc = hashPair(c, c);
  // layer 2: pair(ab, cc)
  const expected = hashPair(ab, cc);
  assert.equal(tree.root, expected);
  assert.equal(tree.leafCount, 3);
  assert.equal(tree.layers.length, 3);
});

test("buildMerkleTree produces correct root for 4-leaf input (balanced)", () => {
  const a = "0x" + "01".repeat(32);
  const b = "0x" + "02".repeat(32);
  const c = "0x" + "03".repeat(32);
  const d = "0x" + "04".repeat(32);
  const tree = buildMerkleTree([a, b, c, d]);
  const ab = hashPair(a, b);
  const cd = hashPair(c, d);
  const expected = hashPair(ab, cd);
  assert.equal(tree.root, expected);
  assert.equal(tree.layers.length, 3);
  assert.equal(tree.leafCount, 4);
});

test("buildMerkleTree produces correct root for 5-leaf input", () => {
  const leaves = ["aa", "bb", "cc", "dd", "ee"].map((seed) => "0x" + seed.repeat(32));
  const [a, b, c, d, e] = leaves;
  const tree = buildMerkleTree(leaves);
  // layer 1: pair(a,b), pair(c,d), pair(e,e)
  const ab = hashPair(a, b);
  const cd = hashPair(c, d);
  const ee = hashPair(e, e);
  // layer 2: pair(ab,cd), pair(ee,ee)
  const abcd = hashPair(ab, cd);
  const eeee = hashPair(ee, ee);
  // layer 3: pair(abcd, eeee)
  const expected = hashPair(abcd, eeee);
  assert.equal(tree.root, expected);
  assert.equal(tree.leafCount, 5);
});

// --- inclusion proof verification ---------------------------------------

test("verifyProof accepts valid proofs for every leaf in a 5-leaf tree", () => {
  const leaves = ["aa", "bb", "cc", "dd", "ee"].map((seed) => "0x" + seed.repeat(32));
  const tree = buildMerkleTree(leaves);
  for (let i = 0; i < leaves.length; i += 1) {
    const proof = generateProof(tree, i);
    assert.equal(verifyProof(leaves[i], proof, tree.root), true, `proof for leaf ${i} should verify`);
  }
});

test("verifyProof rejects tampered proofs and tampered roots", () => {
  const leaves = ["aa", "bb", "cc", "dd"].map((seed) => "0x" + seed.repeat(32));
  const tree = buildMerkleTree(leaves);
  const proof = generateProof(tree, 1);
  // valid baseline
  assert.equal(verifyProof(leaves[1], proof, tree.root), true);
  // tamper sibling hash
  const tampered = proof.map((step, idx) => idx === 0 ? { ...step, hash: "0x" + "ff".repeat(32) } : step);
  assert.equal(verifyProof(leaves[1], tampered, tree.root), false);
  // tamper root
  assert.equal(verifyProof(leaves[1], proof, "0x" + "00".repeat(32)), false);
  // tamper leaf
  assert.equal(verifyProof("0x" + "ff".repeat(32), proof, tree.root), false);
});

// --- collectProofs -------------------------------------------------------

test("collectProofs returns only proofs inside the trailing window", () => {
  const repoRoot = tempRepo();
  const inside1 = "2026-07-01T00:30:00.000Z";
  const inside2 = "2026-07-01T11:59:00.000Z";
  const outsideOld = "2026-06-30T11:00:00.000Z"; // > 24h before windowEnd
  const outsideFuture = "2026-07-02T12:00:00.000Z"; // after windowEnd
  for (const iso of [inside1, inside2, outsideOld, outsideFuture]) {
    const day = iso.slice(0, 10);
    writeProofFile(repoRoot, day, fileNameForIso(iso), makeProof(1, iso));
  }
  const windowEnd = new Date("2026-07-01T12:00:00.000Z");
  const collected = collectProofs(repoRoot, 24, windowEnd);
  const timestamps = collected.map((p) => p.timestamp);
  assert.equal(collected.length, 2);
  assert.ok(timestamps.includes(inside1));
  assert.ok(timestamps.includes(inside2));
  for (const item of collected) {
    assert.match(item.hash, /^0x[0-9a-f]{64}$/);
    assert.ok(item.signedProofPath.startsWith("runtime/proofs/"));
  }
});

// --- idempotency ---------------------------------------------------------

test("anchorIdempotencyKey is stable per windowEndIso and differs across instants", () => {
  const a = anchorIdempotencyKey("2026-07-01T00:00:00.000Z");
  const b = anchorIdempotencyKey("2026-07-01T00:00:00.000Z");
  const c = anchorIdempotencyKey("2026-07-02T00:00:00.000Z");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 32);
});

// --- gating --------------------------------------------------------------

test("isAnchorEnabled refuses when not enabled, when preLaunchVerified false, when no contract", () => {
  const repoRoot = tempRepo();
  const cfg1 = baseConfig(repoRoot);
  cfg1.anchor.enabled = false;
  const r1 = isAnchorEnabled(cfg1, readyState());
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /ORBIT_ENABLE_MERKLE_ANCHOR/);

  const cfg2 = baseConfig(repoRoot);
  const r2 = isAnchorEnabled(cfg2, readyState({ preLaunchVerified: false }));
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /preLaunchVerified/);

  const cfg3 = baseConfig(repoRoot);
  cfg3.anchor.contractAddress = "";
  const r3 = isAnchorEnabled(cfg3, readyState());
  assert.equal(r3.ok, false);
  assert.match(r3.reason, /contract/);

  const cfg4 = baseConfig(repoRoot);
  assert.deepEqual(isAnchorEnabled(cfg4, readyState()), { ok: true });
});

// --- proposeAnchor -------------------------------------------------------

test("proposeAnchor in dry-run writes ledger entry and creates approval issue with no network swap", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  // seed three proofs in the window
  const iso1 = "2026-07-01T01:00:00.000Z";
  const iso2 = "2026-07-01T05:00:00.000Z";
  const iso3 = "2026-07-01T09:00:00.000Z";
  for (const iso of [iso1, iso2, iso3]) {
    writeProofFile(repoRoot, iso.slice(0, 10), fileNameForIso(iso), makeProof(1, iso));
  }
  const github = fakeGithub({ proposalIssueNumber: 77 });
  const windowEndIso = "2026-07-01T12:00:00.000Z";
  const result = await proposeAnchor(config, {
    cycle: 100,
    state: readyState({ cycle: 100 }),
    github,
    now: new Date(windowEndIso)
  }, { windowEndIso, rationale: "first daily anchor" });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.leafCount, 3);
  assert.match(result.root, /^0x[0-9a-f]{64}$/);
  assert.notEqual(result.root, ZERO_ROOT);
  assert.equal(result.proposalIssueNumber, 77);
  assert.equal(github.created.length, 1);
  assert.ok(github.created[0].labels.includes("orbit:approval"));
  assert.ok(github.created[0].labels.includes("orbit:merkle-anchor"));
  // root and leaf count should appear in the body, no raw proof bodies
  assert.ok(github.created[0].body.includes(result.root));
  assert.ok(github.created[0].body.includes(`Leaf count: \`${result.leafCount}\``));
  assert.ok(!github.created[0].body.includes("cycle\":1"));

  const ledger = loadAnchorLedger(repoRoot);
  assert.equal(ledger.anchors.length, 1);
  assert.equal(ledger.anchors[0].root, result.root);
  assert.equal(ledger.anchors[0].leafCount, 3);
  assert.equal(ledger.anchors[0].status, "proposed_dry");
});

test("proposeAnchor returns blocked when not enabled", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  config.anchor.enabled = false;
  const result = await proposeAnchor(config, {
    cycle: 1,
    state: readyState(),
    github: fakeGithub()
  }, { windowEndIso: "2026-07-01T00:00:00.000Z" });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /ORBIT_ENABLE_MERKLE_ANCHOR/);
});

// --- executeAnchor -------------------------------------------------------

test("T-1: executeAnchor refuses when state-coherence check breaches treasury floor", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  // Treasury state already below floor — coherence check (amount=0) must fail.
  const breachedState = readyState({
    treasury: {
      floorWei: "1000000000000000000",      // 1 ETH floor
      balanceEstimateWei: "500000000000000000" // est: 0.5 ETH — below floor before any spend
    }
  });
  const result = await executeAnchor(config, {
    state: breachedState,
    github: fakeGithub()
  }, { proposalIssueNumber: 999 });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.status, "blocked_treasury_floor");
  assert.match(result.reason, /treasury_floor/);
});

test("executeAnchor in dry-run with full approval returns synthetic txHash and no network call", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  // seed one proof
  writeProofFile(
    repoRoot,
    "2026-07-01",
    fileNameForIso("2026-07-01T06:00:00.000Z"),
    makeProof(1, "2026-07-01T06:00:00.000Z")
  );
  const proposalIssueNumber = 88;
  // First propose
  const github = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approval", "orbit:approved"],
    comments: []
  });
  const windowEndIso = "2026-07-01T12:00:00.000Z";
  const proposal = await proposeAnchor(config, {
    cycle: 9,
    state: readyState(),
    github,
    now: new Date(windowEndIso)
  }, { windowEndIso });
  assert.equal(proposal.ok, true);
  // attach the owner APPROVE comment
  github.comments = [{
    author: "owner",
    body: `APPROVE ORBIT-MERKLE-ANCHOR ${proposal.idem}`
  }];
  const result = await executeAnchor(config, {
    cycle: 9,
    state: readyState(),
    github
  }, { proposalIssueNumber });
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.status, "executed_dry");
  assert.match(result.txHash, /^0xanc[0-9a-f]{61}$/);
  assert.equal(result.root, proposal.root);
});

test("executeAnchor blocks when approval label is missing", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  writeProofFile(
    repoRoot,
    "2026-07-01",
    fileNameForIso("2026-07-01T06:00:00.000Z"),
    makeProof(1, "2026-07-01T06:00:00.000Z")
  );
  const proposalIssueNumber = 99;
  // No "orbit:approved" label set on the issue.
  const github = fakeGithub({ proposalIssueNumber, labels: ["orbit:approval"], comments: [] });
  const windowEndIso = "2026-07-01T12:00:00.000Z";
  const proposal = await proposeAnchor(config, {
    cycle: 9,
    state: readyState(),
    github,
    now: new Date(windowEndIso)
  }, { windowEndIso });
  assert.equal(proposal.ok, true);
  // Provide an APPROVE comment to isolate the label-missing case.
  github.comments = [{
    author: "owner",
    body: `APPROVE ORBIT-MERKLE-ANCHOR ${proposal.idem}`
  }];
  const result = await executeAnchor(config, {
    cycle: 9,
    state: readyState(),
    github
  }, { proposalIssueNumber });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.status, "pending_approval");
});

// --- handler sanitization -----------------------------------------------

test("propose_merkle_anchor handler returns only sanitized fields (no leaf bodies)", async () => {
  const repoRoot = tempRepo();
  // Set up state.json so the handler can read it.
  fs.writeFileSync(
    path.join(repoRoot, "memory", "state.json"),
    JSON.stringify(readyState({ cycle: 10 }), null, 2)
  );
  const iso = "2026-07-01T07:00:00.000Z";
  writeProofFile(repoRoot, iso.slice(0, 10), fileNameForIso(iso), makeProof(1, iso));
  const config = baseConfig(repoRoot);
  const github = fakeGithub({ proposalIssueNumber: 123 });
  const result = await executeTool(
    config,
    github,
    10,
    "propose_merkle_anchor",
    { windowEndIso: "2026-07-01T12:00:00.000Z" }
  );
  const allowed = new Set([
    "kind", "action", "ok", "dryRun", "blocked", "root", "leafCount",
    "proposalIssueUrl", "proposalIssueNumber", "idem", "idempotent",
    "status", "reason"
  ]);
  for (const key of Object.keys(result)) {
    assert.ok(allowed.has(key), `handler returned unexpected key: ${key}`);
  }
  assert.equal(result.kind, "merkle_anchor");
  assert.equal(result.action, "propose");
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.match(result.root, /^0x[0-9a-f]{64}$/);
  // No leaf bodies, no proof path strings, no signature fields.
  assert.equal(result.steps, undefined);
  assert.equal(result.signedProofPath, undefined);
  assert.equal(result.leaves, undefined);
});
