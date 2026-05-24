"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { executeTool } = require("../src/agent/actions");
const {
  BUYBACK_LEDGER_PATH,
  buybackIdempotencyKey,
  deterministicMockOrbitReceived,
  executeBuyback,
  formatBuybackReceipt,
  isBuybackEnabled,
  loadBuybackLedger,
  proposeBuyback,
  weekStartFromDate
} = require("../src/agent/buyback");

const VALID_TOKEN = "0x1111111111111111111111111111111111111111";
const VALID_ROUTER = "0x2222222222222222222222222222222222222222";
const VALID_WETH = "0x4200000000000000000000000000000000000006";

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-buyback-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  fs.writeFileSync(path.join(dir, "memory", "governance.json"), JSON.stringify({
    ownerUsername: "owner",
    policyVersion: 1,
    externalSpend: { mode: "owner_approval_required" }
  }, null, 2));
  fs.writeFileSync(path.join(dir, "memory", "approvals.json"), JSON.stringify({ approvals: [] }, null, 2));
  return dir;
}

function baseConfig(repoRoot, overrides = {}) {
  return {
    repoRoot,
    ownerUsername: "owner",
    approvalIssueLabel: "orbit:approval",
    approvalAcceptedLabel: "orbit:approved",
    approvalRejectedLabel: "orbit:rejected",
    treasuryAddress: "0x3333333333333333333333333333333333333333",
    operatorRevenueAddress: "0x4444444444444444444444444444444444444444",
    buyback: {
      enabled: true,
      dryRun: true,
      routerAddress: VALID_ROUTER,
      pairedTokenAddress: VALID_WETH,
      weeklyMaxWeth: "0.5",
      slippageBps: 100,
      approvalIssueLabel: "orbit:approval"
    },
    ...overrides
  };
}

function readyState(overrides = {}) {
  return {
    cycle: 42,
    preLaunchVerified: true,
    tokenAddress: VALID_TOKEN,
    ...overrides
  };
}

function fakeGithub({ proposalIssueNumber = 17, labels = [], comments = [] } = {}) {
  let lastIssue = null;
  return {
    created: [],
    async createIssue(issue) {
      this.created.push(issue);
      const result = { number: proposalIssueNumber, url: `https://example.com/${proposalIssueNumber}`, html_url: `https://github.com/example/${proposalIssueNumber}` };
      lastIssue = result;
      return result;
    },
    async getIssue(number) {
      if (number !== proposalIssueNumber) return null;
      return { number, labels };
    },
    async listIssueComments(number) {
      if (number !== proposalIssueNumber) return [];
      return comments;
    }
  };
}

// ----- isBuybackEnabled --------------------------------------------------

test("isBuybackEnabled refuses when state.preLaunchVerified !== true", () => {
  const config = baseConfig(tempRepo());
  const state = readyState({ preLaunchVerified: false });
  const result = isBuybackEnabled(config, state);
  assert.equal(result.ok, false);
  assert.match(result.reason, /preLaunchVerified/);
});

test("isBuybackEnabled refuses when tokenAddress unset", () => {
  const config = baseConfig(tempRepo());
  const state = readyState({ tokenAddress: "" });
  const result = isBuybackEnabled(config, state);
  assert.equal(result.ok, false);
  assert.match(result.reason, /tokenAddress/);
});

test("isBuybackEnabled refuses when ORBIT_ENABLE_BUYBACK=false", () => {
  const config = baseConfig(tempRepo());
  config.buyback.enabled = false;
  const result = isBuybackEnabled(config, readyState());
  assert.equal(result.ok, false);
  assert.match(result.reason, /ORBIT_ENABLE_BUYBACK/);
});

test("isBuybackEnabled refuses when router address missing", () => {
  const config = baseConfig(tempRepo());
  config.buyback.routerAddress = "";
  const result = isBuybackEnabled(config, readyState());
  assert.equal(result.ok, false);
  assert.match(result.reason, /router/);
});

test("isBuybackEnabled accepts when all preconditions met", () => {
  const config = baseConfig(tempRepo());
  const result = isBuybackEnabled(config, readyState());
  assert.deepEqual(result, { ok: true });
});

// ----- idempotency key ---------------------------------------------------

test("buybackIdempotencyKey is stable per (cycle, weekStart) and differs across week", () => {
  const a = buybackIdempotencyKey(42, "2026-05-18");
  const b = buybackIdempotencyKey(42, "2026-05-18");
  const c = buybackIdempotencyKey(42, "2026-05-25");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 32);
});

test("weekStartFromDate aligns to UTC Monday", () => {
  // Sunday May 24 2026 18:00 UTC -> should align to Monday May 18
  const ws = weekStartFromDate("2026-05-24T18:00:00Z");
  assert.equal(ws, "2026-05-18");
  // Monday itself returns itself
  assert.equal(weekStartFromDate("2026-05-18T00:00:00Z"), "2026-05-18");
});

// ----- proposeBuyback ----------------------------------------------------

test("proposeBuyback writes ledger entry in dry-run and creates approval issue", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const github = fakeGithub({ proposalIssueNumber: 21 });

  const result = await proposeBuyback(config, {
    cycle: 42,
    state: readyState({ cycle: 42 }),
    github,
    now: new Date("2026-05-20T12:00:00Z")
  }, { wethAmount: "0.1", rationale: "weekly buyback test" });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.proposalIssueNumber, 21);
  assert.equal(github.created.length, 1);
  assert.ok(github.created[0].labels.includes("orbit:approval"));
  assert.ok(github.created[0].labels.includes("orbit:buyback"));

  const ledger = loadBuybackLedger(repoRoot);
  assert.equal(ledger.buybacks.length, 1);
  assert.equal(ledger.buybacks[0].dryRun, true);
  assert.equal(ledger.buybacks[0].wethProposed, "0.1");
  assert.equal(ledger.buybacks[0].approved, false);
  assert.equal(ledger.buybacks[0].status, "proposed_dry");
});

test("proposeBuyback returns blocked when not enabled", async () => {
  const config = baseConfig(tempRepo());
  config.buyback.enabled = false;
  const result = await proposeBuyback(config, {
    cycle: 1,
    state: readyState(),
    github: fakeGithub()
  }, { wethAmount: "0.1", rationale: "should not happen" });

  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /ORBIT_ENABLE_BUYBACK/);
});

test("proposeBuyback enforces weeklyMaxWeth ceiling", async () => {
  const config = baseConfig(tempRepo());
  config.buyback.weeklyMaxWeth = "0.05";
  await assert.rejects(
    () => proposeBuyback(config, {
      cycle: 1,
      state: readyState(),
      github: fakeGithub()
    }, { wethAmount: "0.5", rationale: "too big" }),
    /weeklyMaxWeth/
  );
});

// ----- executeBuyback ----------------------------------------------------

test("executeBuyback returns blocked without the orbit:approved label", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 31;
  const github = fakeGithub({ proposalIssueNumber });

  const proposal = await proposeBuyback(config, {
    cycle: 5,
    state: readyState(),
    github
  }, { wethAmount: "0.1", rationale: "no approval yet" });
  assert.equal(proposal.ok, true);

  // Now try to execute — no approval label, no owner comment
  const execGithub = fakeGithub({ proposalIssueNumber, labels: [], comments: [] });
  const result = await executeBuyback(config, {
    cycle: 5,
    state: readyState(),
    github: execGithub
  }, { proposalIssueNumber });

  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /label|approval/i);
});

test("executeBuyback returns blocked when only the label is set but no owner comment", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 33;
  const github = fakeGithub({ proposalIssueNumber });
  await proposeBuyback(config, {
    cycle: 6,
    state: readyState(),
    github
  }, { wethAmount: "0.1", rationale: "label only" });

  const execGithub = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approved"],
    comments: []
  });
  const result = await executeBuyback(config, {
    cycle: 6,
    state: readyState(),
    github: execGithub
  }, { proposalIssueNumber });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
});

test("executeBuyback in dry-run with full approval simulates a swap and writes ledger", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 41;
  const github = fakeGithub({ proposalIssueNumber });
  const proposal = await proposeBuyback(config, {
    cycle: 9,
    state: readyState(),
    github
  }, { wethAmount: "0.2", rationale: "approved test" });
  assert.equal(proposal.ok, true);

  const idem = proposal.idem;
  const execGithub = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approved"],
    comments: [{ author: "owner", body: `APPROVE ORBIT-BUYBACK ${idem}` }]
  });

  // Spy on global fetch to assert no network in dry-run
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = (...args) => {
    fetchCalls += 1;
    if (originalFetch) return originalFetch(...args);
    return Promise.reject(new Error("no fetch in test"));
  };

  try {
    const result = await executeBuyback(config, {
      cycle: 9,
      state: readyState(),
      github: execGithub
    }, { proposalIssueNumber });

    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.match(result.txHash, /^0xdry/);
    assert.equal(result.wethSpent, "0.2");
    assert.ok(result.orbitReceived);
    assert.equal(fetchCalls, 0, "dry-run must not call fetch");
  } finally {
    global.fetch = originalFetch;
  }

  const ledger = loadBuybackLedger(repoRoot);
  const entry = ledger.buybacks.find((item) => item.proposalIssueNumber === proposalIssueNumber);
  assert.ok(entry);
  assert.equal(entry.status, "executed_dry");
  assert.equal(entry.approved, true);
  assert.equal(entry.dryRun, true);
});

test("executeBuyback ignores APPROVE comments from non-owner authors", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 47;
  const github = fakeGithub({ proposalIssueNumber });
  const proposal = await proposeBuyback(config, {
    cycle: 11,
    state: readyState(),
    github
  }, { wethAmount: "0.1", rationale: "non owner only" });

  const execGithub = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approved"],
    comments: [{ author: "visitor", body: `APPROVE ORBIT-BUYBACK ${proposal.idem}` }]
  });
  const result = await executeBuyback(config, {
    cycle: 11,
    state: readyState(),
    github: execGithub
  }, { proposalIssueNumber });

  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
});

test("executeBuyback is blocked by preconditions even with a fully-approved issue", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 55;
  const github = fakeGithub({ proposalIssueNumber });
  const proposal = await proposeBuyback(config, {
    cycle: 13,
    state: readyState(),
    github
  }, { wethAmount: "0.1", rationale: "later we drop a precondition" });

  // Now state regresses: preLaunchVerified flipped to false
  const execGithub = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approved"],
    comments: [{ author: "owner", body: `APPROVE ORBIT-BUYBACK ${proposal.idem}` }]
  });
  const result = await executeBuyback(config, {
    cycle: 13,
    state: readyState({ preLaunchVerified: false }),
    github: execGithub
  }, { proposalIssueNumber });

  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /preLaunchVerified/);
});

// ----- receipt formatting ------------------------------------------------

test("formatBuybackReceipt produces the expected shape", () => {
  const receipt = formatBuybackReceipt({
    idem: "abc",
    cycle: 7,
    weekStart: "2026-05-18",
    approved: true,
    dryRun: true,
    wethProposed: "0.1",
    wethSpent: "0.1",
    orbitReceived: "12345.000000",
    txHash: "0xdry00",
    status: "executed_dry",
    proposalIssueUrl: "https://example.com/1",
    executedAt: "2026-05-20T00:00:00.000Z"
  });
  assert.equal(receipt.kind, "buyback");
  assert.equal(receipt.idem, "abc");
  assert.equal(receipt.cycle, 7);
  assert.equal(receipt.weekStart, "2026-05-18");
  assert.equal(receipt.approved, true);
  assert.equal(receipt.dryRun, true);
  assert.equal(receipt.wethSpent, "0.1");
  assert.equal(receipt.orbitReceived, "12345.000000");
  assert.equal(receipt.txHash, "0xdry00");
  assert.equal(receipt.status, "executed_dry");
  assert.equal(receipt.at, "2026-05-20T00:00:00.000Z");
});

test("deterministicMockOrbitReceived is deterministic per idem", () => {
  const a = deterministicMockOrbitReceived("0.1", "abc123def456");
  const b = deterministicMockOrbitReceived("0.1", "abc123def456");
  const c = deterministicMockOrbitReceived("0.1", "999999999999");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

// ----- handler integration -----------------------------------------------

function tempRepoWithState(state) {
  const repoRoot = tempRepo();
  fs.writeFileSync(path.join(repoRoot, "memory", "state.json"), JSON.stringify(state, null, 2));
  return repoRoot;
}

test("propose_buyback handler returns only safe summary fields when enabled", async () => {
  const repoRoot = tempRepoWithState(readyState({ cycle: 27 }));
  const config = baseConfig(repoRoot);
  const github = fakeGithub({ proposalIssueNumber: 88 });

  const result = await executeTool(config, github, 27, "propose_buyback", {
    wethAmount: "0.1",
    rationale: "tool handler test"
  });

  const allowedKeys = new Set([
    "kind",
    "action",
    "ok",
    "dryRun",
    "blocked",
    "proposalIssueUrl",
    "proposalIssueNumber",
    "idem",
    "idempotent",
    "status",
    "reason"
  ]);
  for (const key of Object.keys(result)) {
    assert.ok(allowedKeys.has(key), `unexpected key in handler output: ${key}`);
  }
  assert.equal(result.kind, "buyback");
  assert.equal(result.action, "propose");
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.proposalIssueNumber, 88);
});

test("propose_buyback handler returns blocked when ORBIT_ENABLE_BUYBACK is false", async () => {
  const repoRoot = tempRepoWithState(readyState());
  const config = baseConfig(repoRoot);
  config.buyback.enabled = false;
  const result = await executeTool(config, fakeGithub(), 27, "propose_buyback", {
    wethAmount: "0.1",
    rationale: "blocked test"
  });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /ORBIT_ENABLE_BUYBACK/);
});

test("execute_buyback handler returns only safe summary fields and no router calldata", async () => {
  const repoRoot = tempRepoWithState(readyState({ cycle: 27 }));
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 91;
  const github = fakeGithub({ proposalIssueNumber });
  const proposal = await executeTool(config, github, 27, "propose_buyback", {
    wethAmount: "0.1",
    rationale: "exec handler test"
  });
  assert.equal(proposal.ok, true);

  const ledger = loadBuybackLedger(repoRoot);
  const entry = ledger.buybacks[0];
  const execGithub = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approved"],
    comments: [{ author: "owner", body: `APPROVE ORBIT-BUYBACK ${entry.idem}` }]
  });

  const result = await executeTool(config, execGithub, 27, "execute_buyback", {
    proposalIssueNumber
  });

  const allowedKeys = new Set([
    "kind",
    "action",
    "ok",
    "dryRun",
    "blocked",
    "txHash",
    "wethSpent",
    "orbitReceived",
    "slippageBps",
    "idem",
    "status",
    "reason"
  ]);
  for (const key of Object.keys(result)) {
    assert.ok(allowedKeys.has(key), `unexpected key in handler output: ${key}`);
  }
  assert.equal(result.kind, "buyback");
  assert.equal(result.action, "execute");
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.match(result.txHash, /^0xdry/);
  // ensure no internal router fields leaked
  assert.equal(result.calldata, undefined);
  assert.equal(result.privateKey, undefined);
});

test("BUYBACK_LEDGER_PATH points at memory/buybacks.json", () => {
  assert.equal(BUYBACK_LEDGER_PATH, "memory/buybacks.json");
});
