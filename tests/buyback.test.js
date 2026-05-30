"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { executeTool } = require("../src/agent/actions");
const {
  BUYBACK_LEDGER_PATH,
  CAMPAIGN_STATE_PATH,
  buybackIdempotencyKey,
  deterministicMockOrbitReceived,
  executeBuyback,
  formatBuybackReceipt,
  isBuybackEnabled,
  loadBuybackLedger,
  loadCampaignState,
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

// S-BUY-1 / S-FLOOR-1: by default, supply enough Fee Receive observation +
// week-start snapshot that the fee-floor evaluates to met. Individual tests
// override these to exercise the not-met path.
const FLOOR_MET_BALANCE_WEI = "500000000000000000"; // 0.5 WETH > 0.1 floor
const FLOOR_MET_WEEK_START_BALANCE = "0";

function readyState(overrides = {}) {
  return {
    cycle: 42,
    preLaunchVerified: true,
    tokenAddress: VALID_TOKEN,
    feeFloor: {
      weekStartedAt: "2026-05-18T00:00:00.000Z",
      weekStartBalanceWei: FLOOR_MET_WEEK_START_BALANCE,
      lastWeekBoundaryAt: "2026-05-18T00:00:00.000Z"
    },
    treasurySweep: {
      lastObservedFeeReceiveBalanceWei: FLOOR_MET_BALANCE_WEI
    },
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

test("proposeBuyback uses context.env for Safe address resolution (no global mutation)", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const github = fakeGithub({ proposalIssueNumber: 91 });
  // EIP-55 checksummed test address; addressOf accepts any single Safe env var.
  const injectedSafe = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";

  // Sanity-check: ensure no real env var is bleeding into the test.
  const previousProcessVal = process.env.ORBIT_BUYBACK_SAFE;
  delete process.env.ORBIT_BUYBACK_SAFE;
  try {
    const result = await proposeBuyback(config, {
      cycle: 42,
      state: readyState({ cycle: 42 }),
      github,
      env: { ORBIT_BUYBACK_SAFE: injectedSafe },
      now: new Date("2026-05-20T12:00:00Z")
    }, { wethAmount: "0.1", rationale: "env injection test" });

    assert.equal(result.ok, true);
    assert.equal(github.created.length, 1);
    const body = github.created[0].body || "";
    assert.ok(
      body.includes(`Buyback Safe (D-019 destination): \`${injectedSafe}\``),
      "approval-issue body should carry the injected Safe address"
    );
    // process.env was not mutated by the call.
    assert.equal(process.env.ORBIT_BUYBACK_SAFE, undefined);
  } finally {
    if (previousProcessVal === undefined) delete process.env.ORBIT_BUYBACK_SAFE;
    else process.env.ORBIT_BUYBACK_SAFE = previousProcessVal;
  }
});

test("proposeBuyback with explicit empty context.env suppresses Safe line (fail-closed)", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const github = fakeGithub({ proposalIssueNumber: 92 });
  const injectedSafe = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";

  // Even if process.env carries a Safe address, an explicit context.env
  // override must win — fail-closed behavior keeps tests deterministic.
  const previousProcessVal = process.env.ORBIT_BUYBACK_SAFE;
  process.env.ORBIT_BUYBACK_SAFE = injectedSafe;
  try {
    const result = await proposeBuyback(config, {
      cycle: 42,
      state: readyState({ cycle: 42 }),
      github,
      env: {},
      now: new Date("2026-05-20T12:00:00Z")
    }, { wethAmount: "0.1", rationale: "empty env override" });

    assert.equal(result.ok, true);
    assert.equal(github.created.length, 1);
    const body = github.created[0].body || "";
    assert.ok(
      !body.includes("Buyback Safe (D-019 destination)"),
      "explicit empty env must suppress Safe address line, not fall back to process.env"
    );
    assert.ok(
      !body.includes(injectedSafe),
      "process.env value must not leak when context.env is explicitly provided"
    );
  } finally {
    if (previousProcessVal === undefined) delete process.env.ORBIT_BUYBACK_SAFE;
    else process.env.ORBIT_BUYBACK_SAFE = previousProcessVal;
  }
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

  // S-BUY-1: a buyback is now a CAMPAIGN of N sub-buys. We drain it by
  // calling executeBuyback in a loop with `now` set 100 hours in the
  // future so every scheduled time is due. Per-cycle invariant: AT MOST
  // ONE sub-buy fires per call, so this loop simulates N cycles.
  try {
    const far = new Date(Date.now() + 100 * 3600 * 1000);
    let last;
    for (let i = 0; i < 20; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      last = await executeBuyback(config, {
        cycle: 9 + i,
        state: readyState(),
        github: execGithub
      }, { proposalIssueNumber, now: far });
      if (last && last.status === "executed_dry") break;
    }

    assert.ok(last, "expected at least one executeBuyback call");
    assert.equal(last.ok, true);
    assert.equal(last.dryRun, true);
    assert.match(last.txHash, /^0xdry/);
    assert.ok(last.orbitReceived);
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
  assert.equal(entry.wethSpent, "0.2");
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

  // S-BUY-1: a buyback is a campaign of N randomized sub-buys; the handler
  // fires AT MOST ONE per call. Loop with `now` 100h in the future so every
  // scheduled time is due, then check the final result.
  const far = new Date(Date.now() + 100 * 3600 * 1000).toISOString();
  let result;
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    result = await executeTool(config, execGithub, 27, "execute_buyback", {
      proposalIssueNumber,
      now: far
    });
    if (result && result.status === "executed_dry") break;
  }

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

// ====================================================================
// S-BUY-1: campaign flow tests
// ====================================================================

test("S-BUY-1: proposeBuyback returns blocked + does NOT create issue when fee-floor not met", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const github = fakeGithub({ proposalIssueNumber: 201 });

  // State carries an observation but the weekStartBalance equals it, so
  // weekInflow = 0 < 0.1 floor.
  const state = readyState({
    cycle: 42,
    treasurySweep: { lastObservedFeeReceiveBalanceWei: "0" },
    feeFloor: {
      weekStartedAt: "2026-05-18T00:00:00.000Z",
      weekStartBalanceWei: "0",
      lastWeekBoundaryAt: "2026-05-18T00:00:00.000Z"
    }
  });

  const result = await proposeBuyback(config, {
    cycle: 42,
    state,
    github,
    env: {}, // floor module uses defaults: 0.1 WETH floor
    now: new Date("2026-05-25T00:00:00Z")
  }, { wethAmount: "0.1", rationale: "below floor" });

  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "fee_floor_not_met");
  // CRITICAL: no approval issue should be created when floor is not met.
  assert.equal(github.created.length, 0, "must NOT create an approval issue when floor blocks");
  // And no ledger entry written.
  const ledger = loadBuybackLedger(repoRoot);
  assert.equal(ledger.buybacks.length, 0);
});

test("S-BUY-1: approval issue body describes the campaign (N sub-buys, 48-hour window)", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const github = fakeGithub({ proposalIssueNumber: 202 });

  const result = await proposeBuyback(config, {
    cycle: 99,
    state: readyState({ cycle: 99 }),
    github,
    now: new Date("2026-05-25T00:00:00Z")
  }, { wethAmount: "0.3", rationale: "campaign-shape test" });

  assert.equal(result.ok, true);
  assert.equal(github.created.length, 1);
  const body = github.created[0].body;
  // Spec text: "N sub-buys"
  assert.match(body, /\d+ sub-buys/, "body must mention N sub-buys");
  // Spec text: "48-hour window" (or the configured windowHours)
  assert.match(body, /48-hour window/, "body must mention the 48-hour window");
  // Body must mention randomization
  assert.match(body, /randomized/i);
  // And the buyback-campaign sub-label was applied
  assert.ok(github.created[0].labels.includes("buyback-campaign"), "buyback-campaign sub-label missing");
});

test("S-BUY-1: executeBuyback generates a schedule on first call after approval", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 211;
  const github = fakeGithub({ proposalIssueNumber });

  const proposal = await proposeBuyback(config, {
    cycle: 5,
    state: readyState({ cycle: 5 }),
    github
  }, { wethAmount: "0.1", rationale: "schedule generation" });
  assert.equal(proposal.ok, true);

  const execGithub = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approved"],
    comments: [{ author: "owner", body: `APPROVE ORBIT-BUYBACK ${proposal.idem}` }]
  });

  // Before exec: no active campaign on disk.
  const beforeState = loadCampaignState(repoRoot);
  assert.equal(beforeState.activeCampaign, null);

  // One call at scheduled-time approval-instant — most sub-buys probably
  // aren't due yet (they're spread over 48h) — but the schedule MUST be
  // generated and persisted regardless.
  await executeBuyback(config, {
    cycle: 5,
    state: readyState({ cycle: 5 }),
    github: execGithub
  }, { proposalIssueNumber });

  const afterState = loadCampaignState(repoRoot);
  assert.ok(afterState.activeCampaign, "active campaign must be persisted");
  assert.equal(afterState.activeCampaign.idem, proposal.idem);
  assert.ok(Array.isArray(afterState.activeCampaign.subBuys));
  assert.ok(afterState.activeCampaign.subBuys.length >= 3);
  assert.ok(afterState.activeCampaign.subBuys.length <= 10);
  // Each sub-buy carries scheduledAt, amountWei, status=pending
  for (const sb of afterState.activeCampaign.subBuys) {
    assert.ok(sb.scheduledAt);
    assert.ok(sb.amountWei);
    assert.ok(["pending", "completed", "failed"].includes(sb.status));
  }
});

test("S-BUY-1: executeBuyback fires AT MOST ONE sub-buy per call (even when many are due)", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 221;
  const github = fakeGithub({ proposalIssueNumber });

  const proposal = await proposeBuyback(config, {
    cycle: 7,
    state: readyState({ cycle: 7 }),
    github
  }, { wethAmount: "0.25", rationale: "per-cycle cap" });
  assert.equal(proposal.ok, true);

  const execGithub = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approved"],
    comments: [{ author: "owner", body: `APPROVE ORBIT-BUYBACK ${proposal.idem}` }]
  });

  // Drive `now` far past the window so EVERY scheduled time is due, then
  // verify ONLY ONE sub-buy flips to "completed" per call.
  const far = new Date(Date.now() + 100 * 3600 * 1000);

  // First call: create schedule + fire ONE sub-buy.
  await executeBuyback(config, {
    cycle: 7,
    state: readyState({ cycle: 7 }),
    github: execGithub
  }, { proposalIssueNumber, now: far });

  const state1 = loadCampaignState(repoRoot);
  const completed1 = state1.activeCampaign.subBuys.filter((sb) => sb.status === "completed").length;
  assert.equal(completed1, 1, "first call must fire exactly 1 sub-buy");

  // Second call (same `now`): fires exactly one MORE sub-buy.
  await executeBuyback(config, {
    cycle: 8,
    state: readyState({ cycle: 8 }),
    github: execGithub
  }, { proposalIssueNumber, now: far });

  const state2 = loadCampaignState(repoRoot);
  // Campaign might be archived if it had only 2 sub-buys; check disk + ledger.
  if (state2.activeCampaign) {
    const completed2 = state2.activeCampaign.subBuys.filter((sb) => sb.status === "completed").length;
    assert.equal(completed2, 2, "second call must fire exactly 1 more sub-buy (total 2)");
  } else {
    // Campaign archived. It must have completed total of subBuyCount.
    assert.ok(state2.history.length >= 1);
  }
});

test("S-BUY-1: executeBuyback archives the campaign when complete", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 231;
  const github = fakeGithub({ proposalIssueNumber });

  const proposal = await proposeBuyback(config, {
    cycle: 11,
    state: readyState({ cycle: 11 }),
    github
  }, { wethAmount: "0.15", rationale: "archive on complete" });
  assert.equal(proposal.ok, true);

  const execGithub = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approved"],
    comments: [{ author: "owner", body: `APPROVE ORBIT-BUYBACK ${proposal.idem}` }]
  });

  // Drain the campaign by calling exec in a loop with `now` far in the future.
  const far = new Date(Date.now() + 100 * 3600 * 1000);
  let result;
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    result = await executeBuyback(config, {
      cycle: 11 + i,
      state: readyState({ cycle: 11 + i }),
      github: execGithub
    }, { proposalIssueNumber, now: far });
    if (result && result.status === "executed_dry") break;
  }
  assert.equal(result.status, "executed_dry", "final call should report executed_dry");

  const after = loadCampaignState(repoRoot);
  assert.equal(after.activeCampaign, null, "active campaign must be cleared on completion");
  assert.equal(after.history.length, 1, "exactly one archived campaign expected");
  const archived = after.history[0];
  assert.equal(archived.idem, proposal.idem);
  assert.ok(archived.archivedAt);
  // Every sub-buy completed
  for (const sb of archived.subBuys) {
    assert.equal(sb.status, "completed", `sub-buy ${sb.scheduledAt} not completed`);
    assert.match(sb.txHash, /^0xdry/);
  }
});

test("S-BUY-1: subsequent executeBuyback calls reuse the same campaign (idem match)", async () => {
  const repoRoot = tempRepo();
  const config = baseConfig(repoRoot);
  const proposalIssueNumber = 241;
  const github = fakeGithub({ proposalIssueNumber });

  const proposal = await proposeBuyback(config, {
    cycle: 21,
    state: readyState({ cycle: 21 }),
    github
  }, { wethAmount: "0.2", rationale: "schedule reuse" });
  assert.equal(proposal.ok, true);

  const execGithub = fakeGithub({
    proposalIssueNumber,
    labels: ["orbit:approved"],
    comments: [{ author: "owner", body: `APPROVE ORBIT-BUYBACK ${proposal.idem}` }]
  });

  // First call: schedule generated.
  await executeBuyback(config, {
    cycle: 21,
    state: readyState({ cycle: 21 }),
    github: execGithub
  }, { proposalIssueNumber, now: new Date("2026-05-26T00:00:00Z") });

  const first = loadCampaignState(repoRoot);
  const firstTimes = first.activeCampaign.subBuys.map((sb) => sb.scheduledAt);

  // Second call: same campaign, same schedule (no regeneration).
  await executeBuyback(config, {
    cycle: 22,
    state: readyState({ cycle: 22 }),
    github: execGithub
  }, { proposalIssueNumber, now: new Date("2026-05-26T01:00:00Z") });

  const second = loadCampaignState(repoRoot);
  const secondTimes = second.activeCampaign.subBuys.map((sb) => sb.scheduledAt);
  assert.deepEqual(secondTimes, firstTimes, "schedule must not be regenerated on subsequent calls");
});

test("S-BUY-1: CAMPAIGN_STATE_PATH points at memory/buyback-campaign.json", () => {
  assert.equal(CAMPAIGN_STATE_PATH, "memory/buyback-campaign.json");
});
