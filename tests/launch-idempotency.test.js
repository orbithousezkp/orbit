"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  assertLaunchOnceNotRolled,
  assertStateWriteSafe,
  assertTokenLaunchedDoesNotUnflip
} = require("../src/agent/state-guard");
const {
  __setClankerFactoryForTests,
  hasLaunchPersistFailure,
  LAUNCH_PERSIST_FAILURE_PATH,
  launchNativeToken,
  persistLaunchOnceFired
} = require("../src/agent/clanker");
const { executeTool } = require("../src/agent/actions");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-launch-idem-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function writeState(repoRoot, state) {
  fs.writeFileSync(
    path.join(repoRoot, "memory/state.json"),
    `${JSON.stringify(state, null, 2)}\n`
  );
}

function baseConfig(repoRoot) {
  return {
    repoRoot,
    enableTokenLaunch: false,
    enableRevenueClaims: false,
    treasuryAddress: "0x2222222222222222222222222222222222222222",
    operatorRevenueAddress: "0x3333333333333333333333333333333333333333",
    tokenAdminAddress: "0x4444444444444444444444444444444444444444",
    tokenName: "Orbit",
    tokenSymbol: "ORBIT",
    tokenDescription: "Orbit native token",
    operatorRevenueBps: 5000,
    vaultPercentage: 10,
    vaultLockupDays: 30,
    vaultVestingDays: 30,
    devBuyEth: 0,
    walletPrivateKey: "",
    baseRpcUrl: ""
  };
}

// --- Layer 3: state-guard -----------------------------------------------

test("assertLaunchOnceNotRolled throws when prev=true and next=false", () => {
  assert.throws(
    () => assertLaunchOnceNotRolled({ launchOnceFired: true }, { launchOnceFired: false }),
    /launchOnceFired/
  );
});

test("assertLaunchOnceNotRolled throws when prev=true and next omits the flag", () => {
  assert.throws(
    () => assertLaunchOnceNotRolled({ launchOnceFired: true }, { cycle: 5 }),
    /launchOnceFired/
  );
});

test("assertLaunchOnceNotRolled allows prev=false and next=true (the legitimate transition)", () => {
  assert.doesNotThrow(() => assertLaunchOnceNotRolled({ launchOnceFired: false }, { launchOnceFired: true }));
});

test("assertLaunchOnceNotRolled allows prev=true and next=true (idempotent)", () => {
  assert.doesNotThrow(() => assertLaunchOnceNotRolled({ launchOnceFired: true }, { launchOnceFired: true }));
});

test("assertLaunchOnceNotRolled allows prev=false and next=false (never fired)", () => {
  assert.doesNotThrow(() => assertLaunchOnceNotRolled({ launchOnceFired: false }, { launchOnceFired: false }));
});

test("assertTokenLaunchedDoesNotUnflip throws when launchStatus rolls back", () => {
  const prev = { treasury: { token: { launchStatus: "launched" } } };
  const next = { treasury: { token: { launchStatus: "pending" } } };
  assert.throws(() => assertTokenLaunchedDoesNotUnflip(prev, next), /launchStatus/);
});

test("assertTokenLaunchedDoesNotUnflip allows pending->launched", () => {
  const prev = { treasury: { token: { launchStatus: "pending" } } };
  const next = { treasury: { token: { launchStatus: "launched" } } };
  assert.doesNotThrow(() => assertTokenLaunchedDoesNotUnflip(prev, next));
});

test("assertStateWriteSafe is the union of both guards", () => {
  // Rollback of launchOnceFired AND rollback of launchStatus both caught.
  assert.throws(() => assertStateWriteSafe({ launchOnceFired: true }, { launchOnceFired: false }));
  assert.throws(() => assertStateWriteSafe(
    { treasury: { token: { launchStatus: "launched" } } },
    { treasury: { token: { launchStatus: null } } }
  ));
  assert.doesNotThrow(() => assertStateWriteSafe({}, {}));
});

// Bug B: assertTokenLaunchedDoesNotUnflip + assertStateWriteSafe must read
// launchStatus from the explicit treasury snapshots when supplied, NOT from
// a synthetic prev.treasury that state.json never has.
test("Bug B: assertTokenLaunchedDoesNotUnflip reads launchStatus from treasury args", () => {
  const prevState = { cycle: 5, launchOnceFired: true };
  const nextState = { cycle: 6, launchOnceFired: true };
  const prevTreasury = { token: { launchStatus: "launched" } };
  const nextTreasury = { token: { launchStatus: "not_launched" } };
  let threw = null;
  try {
    assertTokenLaunchedDoesNotUnflip(prevState, nextState, { prevTreasury, nextTreasury });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, "expected LAUNCH_STATUS_ROLLBACK to throw");
  assert.equal(threw.code, "LAUNCH_STATUS_ROLLBACK");
});

test("Bug B: assertStateWriteSafe routes treasury rollback through the 3rd arg", () => {
  const prevState = { launchOnceFired: true };
  const nextState = { launchOnceFired: true };
  const prevTreasury = { token: { launchStatus: "launched" } };
  const nextTreasury = { token: { launchStatus: "not_launched" } };
  let threw = null;
  try {
    assertStateWriteSafe(prevState, nextState, { prevTreasury, nextTreasury });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw);
  assert.equal(threw.code, "LAUNCH_STATUS_ROLLBACK");
});

test("Bug B: assertStateWriteSafe accepts matching treasury launchStatus", () => {
  const prevState = { launchOnceFired: true };
  const nextState = { launchOnceFired: true };
  const prevTreasury = { token: { launchStatus: "launched" } };
  const nextTreasury = { token: { launchStatus: "launched" } };
  assert.doesNotThrow(() => assertStateWriteSafe(prevState, nextState, { prevTreasury, nextTreasury }));
});

test("Bug B: assertStateWriteSafe with no 3rd arg falls back to legacy state.treasury shape (back-compat)", () => {
  assert.throws(() => assertStateWriteSafe(
    { treasury: { token: { launchStatus: "launched" } } },
    { treasury: { token: { launchStatus: "pending" } } }
  ), /launchStatus/);
});

// Bug B (run.js wiring): the Layer 3 launchStatus guard MUST be wired with
// two distinct treasury snapshots — one read BEFORE the cycle's executeTool
// loop (and therefore before any saveTreasury call), and one read AFTER.
// If both reads happen at end-of-cycle they observe the same on-disk bytes
// (saveTreasury already ran), prev === next, and `prev === "launched" &&
// next !== "launched"` becomes `X && !X` which is always false. This test
// simulates the correct wiring by snapshotting treasury.json on disk twice
// across a simulated mutation, then asserting the guard fires.
test("Bug B (wiring): snapshot prev BEFORE saveTreasury, next AFTER — guard throws on rollback", () => {
  const repo = tempRepo();
  const treasuryPath = path.join(repo, "memory/treasury.json");

  // Cycle starts: treasury says launched.
  fs.writeFileSync(
    treasuryPath,
    `${JSON.stringify({ token: { launchStatus: "launched" } }, null, 2)}\n`
  );
  // run.js snapshots BEFORE the executeTool loop.
  const prevTreasury = JSON.parse(fs.readFileSync(treasuryPath, "utf-8"));

  // A buggy tool runs during the cycle and rolls launchStatus back via
  // saveTreasury. This is exactly what Layer 3 must catch.
  fs.writeFileSync(
    treasuryPath,
    `${JSON.stringify({ token: { launchStatus: "not_launched" } }, null, 2)}\n`
  );
  // run.js re-reads AFTER the executeTool loop, before assertStateWriteSafe.
  const nextTreasury = JSON.parse(fs.readFileSync(treasuryPath, "utf-8"));

  // prev !== next now (the old bug had prev === next), so the guard fires.
  assert.notDeepStrictEqual(prevTreasury, nextTreasury, "snapshots must differ — otherwise the guard is dead code");
  let threw = null;
  try {
    assertStateWriteSafe({}, {}, { prevTreasury, nextTreasury });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, "expected LAUNCH_STATUS_ROLLBACK to throw");
  assert.equal(threw.code, "LAUNCH_STATUS_ROLLBACK");
});

test("Bug B (wiring): idempotent same-status snapshots do NOT trip the guard", () => {
  const repo = tempRepo();
  const treasuryPath = path.join(repo, "memory/treasury.json");
  fs.writeFileSync(
    treasuryPath,
    `${JSON.stringify({ token: { launchStatus: "launched" } }, null, 2)}\n`
  );
  const prevTreasury = JSON.parse(fs.readFileSync(treasuryPath, "utf-8"));
  // No saveTreasury call this cycle — re-read sees the same bytes.
  const nextTreasury = JSON.parse(fs.readFileSync(treasuryPath, "utf-8"));
  assert.doesNotThrow(() => assertStateWriteSafe({}, {}, { prevTreasury, nextTreasury }));
});

test("Bug B (wiring): null prev (no treasury yet) and launched next (initial launch) is allowed", () => {
  // Fresh repo, no treasury.json: prevTreasury reads as null. During the
  // cycle the first launch creates treasury.json with launchStatus=launched.
  const prevTreasury = null;
  const nextTreasury = { token: { launchStatus: "launched" } };
  assert.doesNotThrow(() => assertStateWriteSafe({}, {}, { prevTreasury, nextTreasury }));
});

// --- Layer 1: clanker.launchNativeToken refuses on flag ----------------

test("launchNativeToken blocks when state.launchOnceFired is true (regardless of other gates)", async () => {
  const repo = tempRepo();
  const result = await launchNativeToken(baseConfig(repo), 0, {
    preLaunchVerified: true,
    launchOnceFired: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "launch_already_fired");
  assert.match(result.detail, /once-only/);
});

test("launchNativeToken still respects D-018 gate before checking the once-only flag", async () => {
  const repo = tempRepo();
  // preLaunchVerified missing — D-018 gate fires first.
  const result = await launchNativeToken(baseConfig(repo), 0, { launchOnceFired: true });
  assert.equal(result.blocked, true);
  assert.match(result.reason, /preLaunchVerified/);
});

test("persistLaunchOnceFired writes the flag to state.json", () => {
  const repo = tempRepo();
  writeState(repo, { cycle: 3 });
  const out = persistLaunchOnceFired(repo);
  assert.equal(out.ok, true);
  const after = JSON.parse(fs.readFileSync(path.join(repo, "memory/state.json"), "utf-8"));
  assert.equal(after.launchOnceFired, true);
  assert.equal(after.cycle, 3); // preserved
});

test("persistLaunchOnceFired is idempotent (writing true over true does not throw)", () => {
  const repo = tempRepo();
  writeState(repo, { cycle: 3, launchOnceFired: true });
  const out = persistLaunchOnceFired(repo);
  assert.equal(out.ok, true);
});

// Bug A regression: corrupted state.json must NEVER be overwritten with a
// bare { launchOnceFired: true }. The function throws with code PARSE_FAILED
// and the original corrupted bytes remain on disk so an operator can repair.
test("Bug A: persistLaunchOnceFired refuses to write when state.json is unparseable", () => {
  const repo = tempRepo();
  const statePath = path.join(repo, "memory/state.json");
  const corruptedBytes = "{not valid json";
  fs.writeFileSync(statePath, corruptedBytes);

  let threw = null;
  try {
    persistLaunchOnceFired(repo);
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, "expected persistLaunchOnceFired to throw on corrupted state.json");
  assert.equal(threw.code, "PARSE_FAILED");
  assert.equal(threw.reason, "parse_failed");
  assert.match(threw.message, /refusing to write/);

  // Verify the original corrupted bytes are still on disk — no overwrite.
  const afterBytes = fs.readFileSync(statePath, "utf-8");
  assert.equal(afterBytes, corruptedBytes, "state.json bytes must be preserved when parse fails");
});

// Bug A: when state.json does not exist (ENOENT), we are NOT in the
// data-loss scenario — there is nothing to preserve. The function should
// succeed and create a fresh state.json with only the flag set.
test("Bug A: persistLaunchOnceFired writes a fresh state.json when none exists", () => {
  const repo = tempRepo();
  // No state.json written at all.
  const out = persistLaunchOnceFired(repo);
  assert.equal(out.ok, true);
  const after = JSON.parse(fs.readFileSync(path.join(repo, "memory/state.json"), "utf-8"));
  assert.equal(after.launchOnceFired, true);
});

// Bug C: atomic write — no tmp file remains after a successful write.
test("Bug C: persistLaunchOnceFired leaves no .tmp file after success", () => {
  const repo = tempRepo();
  writeState(repo, { cycle: 3 });
  persistLaunchOnceFired(repo);
  const tmp = path.join(repo, "memory/state.json.tmp");
  assert.equal(fs.existsSync(tmp), false, "atomic write must rename tmp to final, leaving no .tmp");
});

// --- Layer 2: actions.js refuses launch_native_token --------------------

test("actions.launch_native_token returns blocked when state.launchOnceFired is true", async () => {
  const repo = tempRepo();
  writeState(repo, { cycle: 1, launchOnceFired: true, preLaunchVerified: true });
  const config = {
    ...baseConfig(repo),
    enableTokenLaunch: true,
    walletPrivateKey: "0x" + "11".repeat(32) // pretend ready; we should be blocked before SDK
  };
  // Minimal github stub — never called because we should block early.
  const github = {};
  const result = await executeTool(config, github, 1, "launch_native_token", {});
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "launch_already_fired");
});

test("actions.launch_native_token blocks BEFORE the approval-issue guard runs", async () => {
  const repo = tempRepo();
  writeState(repo, { cycle: 1, launchOnceFired: true });
  let guardCalled = false;
  // If guardSpend were reached, it would create an approval issue via github.
  // We trap that by failing the test if github.createIssue is invoked.
  const github = {
    async createIssue() { guardCalled = true; return { number: 1, html_url: "x" }; }
  };
  const result = await executeTool(baseConfig(repo), github, 1, "launch_native_token", {});
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "launch_already_fired");
  assert.equal(guardCalled, false, "guard must not be invoked when launchOnceFired is true");
});

// --- Happy path: launch -> flag set -> re-launch blocked ----------------

test("happy path: persistLaunchOnceFired then actions.launch_native_token blocks", async () => {
  const repo = tempRepo();
  // Simulate a successful prior launch — persist the flag, then attempt
  // launch_native_token and confirm it is refused.
  writeState(repo, { cycle: 1, preLaunchVerified: true });
  const persist = persistLaunchOnceFired(repo);
  assert.equal(persist.ok, true);
  const result = await executeTool(baseConfig(repo), {}, 2, "launch_native_token", {});
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "launch_already_fired");
});

// --- state-guard refuses to write rollback ------------------------------

test("persistLaunchOnceFired guards itself: cannot be used to clear the flag", () => {
  // Direct call always sets next=true, so the only way to trigger rollback
  // is to corrupt the prev state to true=>true, which is allowed. We test
  // the assertStateWriteSafe primitive instead.
  assert.throws(
    () => assertStateWriteSafe(
      { launchOnceFired: true },
      { launchOnceFired: false }
    ),
    /append-only/
  );
});

// --- Bug D: write_file cannot overwrite memory/state.json ---------------

test("Bug D: executeTool write_file rejects path memory/state.json", async () => {
  const repo = tempRepo();
  // Seed state.json so the file exists and a write would silently clobber it.
  writeState(repo, { cycle: 7, launchOnceFired: true, preLaunchVerified: true });
  const config = baseConfig(repo);
  const github = {};
  await assert.rejects(
    () => executeTool(config, github, 1, "write_file", {
      path: "memory/state.json",
      content: JSON.stringify({ launchOnceFired: false, cycle: 0 })
    }),
    /direct writes to memory\/state\.json are not allowed/
  );
  // Confirm the on-disk file is unchanged.
  const after = JSON.parse(fs.readFileSync(path.join(repo, "memory/state.json"), "utf-8"));
  assert.equal(after.launchOnceFired, true);
  assert.equal(after.cycle, 7);
});

// --- Bug E: Layer 2 fails closed on unparseable state.json --------------

test("Bug E: executeTool launch_native_token blocks with state_unreadable on corrupted state.json", async () => {
  const repo = tempRepo();
  fs.writeFileSync(path.join(repo, "memory/state.json"), "{not valid json");
  let createIssueCalled = false;
  const github = {
    async createIssue() { createIssueCalled = true; return { number: 1, html_url: "x" }; }
  };
  const result = await executeTool(baseConfig(repo), github, 1, "launch_native_token", {});
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "state_unreadable");
  assert.match(result.detail, /Layer 2/);
  assert.equal(createIssueCalled, false, "must block before any approval-issue work");
});

// --- launched_but_persist_failed contract -------------------------------
//
// Pin the contract for the post-deploy persist-failure path. The on-chain
// launch succeeded (treasury.json Layer 0 recorded "launched") but
// persistLaunchOnceFired threw — Layer 1 was NOT written. The return
// value must surface enough detail for an operator to repair state.json,
// AND a persistent marker file must be written so the next cycle or a
// preflight tool can pick up the alert even if nobody branches on the
// status string.
//
// The persistence failure is triggered the same way Layer 1 already
// trips in production: a corrupted memory/state.json. The
// persistLaunchOnceFired function refuses to overwrite an unparseable
// state.json (PARSE_FAILED) — that is the throw path we exercise here.

function happyLaunchConfig(repo) {
  return {
    ...baseConfig(repo),
    enableTokenLaunch: true,
    // All-lowercase EVM addresses bypass EIP-55 checksum (Safe loader accepts
    // these). Distinct addresses avoid the duplicate-Safe conflict guard.
    treasuryAddress: "0x1111111111111111111111111111111111111111",
    operatorRevenueAddress: "0x2222222222222222222222222222222222222222",
    tokenAdminAddress: "0x3333333333333333333333333333333333333333",
    walletPrivateKey: "0x" + "11".repeat(32)
  };
}

function happyLaunchEnv() {
  // Only ORBIT_TREASURY_SAFE is needed for readiness() (fee-receive Safe).
  // The other 6 Safes are unrelated to launchNativeToken's readiness gate.
  return {
    ORBIT_TREASURY_SAFE: "0x1111111111111111111111111111111111111111"
  };
}

function fakeDeploy(receiptAddress, txHash) {
  return {
    deploy: async () => ({
      txHash,
      error: null,
      waitForTransaction: async () => ({ address: receiptAddress, error: null })
    })
  };
}

test("launched_but_persist_failed: contract — deploy succeeds, Layer 1 throws, status + alert info returned", async () => {
  const repo = tempRepo();
  // Corrupt state.json so persistLaunchOnceFired throws PARSE_FAILED.
  fs.writeFileSync(path.join(repo, "memory/state.json"), "{not valid json");
  __setClankerFactoryForTests(async () => ({
    account: { address: "0x0000000000000000000000000000000000000001" },
    clanker: fakeDeploy("0xaaaa000000000000000000000000000000000001", "0xdeadbeef")
  }));
  try {
    const result = await launchNativeToken(
      happyLaunchConfig(repo),
      0,
      { preLaunchVerified: true, launchOnceFired: false },
      happyLaunchEnv()
    );
    assert.equal(result.status, "launched_but_persist_failed");
    assert.equal(result.address, "0xaaaa000000000000000000000000000000000001");
    assert.equal(result.txHash, "0xdeadbeef");
    assert.ok(typeof result.error === "string" && result.error.length > 0, "error message must be set");
    assert.match(result.error, /refusing to write|atomic write failed|read failed/);
    assert.ok(typeof result.detail === "string", "detail must be present");
    assert.match(result.detail, /Layer 1 flag not persisted/);
    assert.match(result.detail, /operator must intervene/);
  } finally {
    __setClankerFactoryForTests(null);
  }
});

test("launched_but_persist_failed: marker file is written with the expected shape", async () => {
  const repo = tempRepo();
  fs.writeFileSync(path.join(repo, "memory/state.json"), "{not valid json");
  __setClankerFactoryForTests(async () => ({
    account: { address: "0x0000000000000000000000000000000000000001" },
    clanker: fakeDeploy("0xbbbb000000000000000000000000000000000002", "0xcafef00d")
  }));
  try {
    const result = await launchNativeToken(
      happyLaunchConfig(repo),
      0,
      { preLaunchVerified: true, launchOnceFired: false },
      happyLaunchEnv()
    );
    assert.equal(result.status, "launched_but_persist_failed");

    const markerPath = path.join(repo, LAUNCH_PERSIST_FAILURE_PATH);
    assert.equal(fs.existsSync(markerPath), true, "marker file must be written");

    const raw = fs.readFileSync(markerPath, "utf-8");
    const marker = JSON.parse(raw);
    assert.ok(typeof marker.occurred_at === "string" && marker.occurred_at.length > 0, "occurred_at must be an ISO timestamp string");
    assert.ok(!Number.isNaN(Date.parse(marker.occurred_at)), "occurred_at must be a parseable timestamp");
    assert.equal(marker.tx_hash, "0xcafef00d");
    assert.equal(marker.token_address, "0xbbbb000000000000000000000000000000000002");
    assert.ok(typeof marker.error === "string" && marker.error.length > 0, "error must describe the persistence failure");
    assert.ok(typeof marker.action_required === "string", "action_required must be present");
    assert.match(marker.action_required, /Layer 1 \(state\.launchOnceFired\) was NOT persisted/);
    assert.match(marker.action_required, /operator should manually set state\.launchOnceFired=true/i);
    assert.match(marker.action_required, /three-layer defense is degraded/);

    // No leftover tmp file from the atomic write.
    assert.equal(fs.existsSync(`${markerPath}.tmp`), false, "no .tmp file after successful marker write");
  } finally {
    __setClankerFactoryForTests(null);
  }
});

test("hasLaunchPersistFailure: false when no marker, true after failure scenario", async () => {
  const repo = tempRepo();
  assert.equal(hasLaunchPersistFailure(repo), false, "fresh repo has no marker");

  fs.writeFileSync(path.join(repo, "memory/state.json"), "{not valid json");
  __setClankerFactoryForTests(async () => ({
    account: { address: "0x0000000000000000000000000000000000000001" },
    clanker: fakeDeploy("0xcccc000000000000000000000000000000000003", "0xfeedface")
  }));
  try {
    await launchNativeToken(
      happyLaunchConfig(repo),
      0,
      { preLaunchVerified: true, launchOnceFired: false },
      happyLaunchEnv()
    );
    assert.equal(hasLaunchPersistFailure(repo), true, "marker must exist after persist failure");
  } finally {
    __setClankerFactoryForTests(null);
  }
});

test("hasLaunchPersistFailure: returns false for missing repoRoot", () => {
  assert.equal(hasLaunchPersistFailure(null), false);
  assert.equal(hasLaunchPersistFailure(""), false);
  assert.equal(hasLaunchPersistFailure(undefined), false);
});

test("happy launch path: when Layer 1 persists, no marker file is written", async () => {
  const repo = tempRepo();
  // Valid state.json — persistLaunchOnceFired succeeds.
  writeState(repo, { cycle: 5 });
  __setClankerFactoryForTests(async () => ({
    account: { address: "0x0000000000000000000000000000000000000001" },
    clanker: fakeDeploy("0xdddd000000000000000000000000000000000004", "0xbada55")
  }));
  try {
    const result = await launchNativeToken(
      happyLaunchConfig(repo),
      0,
      { preLaunchVerified: true, launchOnceFired: false },
      happyLaunchEnv()
    );
    assert.equal(result.status, "launched");
    assert.equal(result.address, "0xdddd000000000000000000000000000000000004");
    assert.equal(hasLaunchPersistFailure(repo), false, "no marker on the happy path");
  } finally {
    __setClankerFactoryForTests(null);
  }
});
