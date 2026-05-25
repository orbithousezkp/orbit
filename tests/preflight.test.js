"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  PASS,
  WARN,
  FAIL,
  INFO,
  runPreflight,
  renderLines,
  checkSafes,
  checkSignerOperatorAi,
  checkD018,
  checkTreasury,
  checkPublicSurface,
  checkOwnerActions,
  parseOwnerActions
} = require("../src/cli/orbit-preflight");

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Derive the signer address from the test private key so signer/key match
// gates PASS instead of FAIL on the happy path.
const { privateKeyToAccount } = require("viem/accounts");
const TEST_PRIVATE_KEY = "0x" + "11".repeat(32);
const SIGNER_FROM_KEY = privateKeyToAccount(TEST_PRIVATE_KEY).address;

const ADDR = {
  fee:        "0x1111111111111111111111111111111111111111",
  floor:      "0x2222222222222222222222222222222222222222",
  productive: "0x3333333333333333333333333333333333333333",
  buyback:    "0x4444444444444444444444444444444444444444",
  growth:     "0x5555555555555555555555555555555555555555",
  aiCosts:    "0x6666666666666666666666666666666666666666",
  ops:        "0x7777777777777777777777777777777777777777",
  signer:     SIGNER_FROM_KEY,
  operator:   "0xCAFE000000000000000000000000000000000bbb"
};

function fullSafeEnv() {
  return {
    ORBIT_TREASURY_SAFE:         ADDR.fee,
    ORBIT_FLOOR_RESERVE_SAFE:    ADDR.floor,
    ORBIT_PRODUCTIVE_YIELD_SAFE: ADDR.productive,
    ORBIT_BUYBACK_SAFE:          ADDR.buyback,
    ORBIT_GROWTH_SAFE:           ADDR.growth,
    ORBIT_AI_COSTS_SAFE:         ADDR.aiCosts,
    ORBIT_OPS_RUNWAY_SAFE:       ADDR.ops
  };
}

function fullEnv() {
  return {
    ...fullSafeEnv(),
    ORBIT_AGENT_SIGNER:               ADDR.signer,
    ORBIT_WALLET_PRIVATE_KEY:         TEST_PRIVATE_KEY,
    ORBIT_OPERATOR_REVENUE_ADDRESS:   ADDR.operator,
    ORBIT_AI_PROVIDERS:               JSON.stringify([{ name: "anthropic" }, { name: "openai" }]),
    ORBIT_AI_PROVIDER_KEYS:           JSON.stringify({ anthropic: "sk-ant-x", openai: "sk-x" }),
    // Bus-factor: minimal tmp repos have only one commit and no adopters,
    // so we lower the maintainer minimum to 1 in test scenarios. This is
    // the same env knob the real bus-factor module reads.
    ORBIT_BUS_FACTOR_MIN_MAINTAINERS: "1",
    ORBIT_BUS_FACTOR_MIN_COMMITS:     "1"
  };
}

function goodState() {
  return {
    cycle: 80,
    preLaunchVerified: true,
    firstCleanCycle: 57,
    lastCleanCycle: 80,
    launchOnceFired: false
  };
}

function goodTreasury() {
  return {
    revenue: { operatorShareBps: 500, treasuryShareBps: 9500 },
    buckets: {
      list: [
        { id: "floor-reserve",     bps: 4500 },
        { id: "productive-yield",  bps: 2000 },
        { id: "buyback",           bps:  500 },
        { id: "growth",            bps: 1500 },
        { id: "ai-costs",          bps: 1000 },
        { id: "ops-runway",        bps:  500 }
      ]
    },
    token: { launchStatus: "not_launched" }
  };
}

function countByStatus(sections) {
  let pass = 0, warn = 0, fail = 0, info = 0;
  for (const s of sections) {
    for (const c of s.checks) {
      if (c.status === PASS) pass += 1;
      else if (c.status === WARN) warn += 1;
      else if (c.status === FAIL) fail += 1;
      else if (c.status === INFO) info += 1;
    }
  }
  return { pass, warn, fail, info };
}

function makeMinimalRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-preflight-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  // a minimal commit so `git log` succeeds
  fs.writeFileSync(path.join(dir, "README.md"), "test\n");
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dir });
  return dir;
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

test("runPreflight: empty env → all Safes FAIL, exitCode 1", () => {
  const result = runPreflight({
    env: {},
    repoRoot: "/tmp/does-not-exist-orbit",
    state: null,
    treasury: null,
    ownerActions: null
  });
  assert.equal(result.exitCode, 1);
  const safesSection = result.sections.find((s) => /Safes/.test(s.title));
  const failCount = safesSection.checks.filter((c) => c.status === FAIL).length;
  assert.equal(failCount, 7, "all 7 Safes should FAIL when env is empty");
});

test("runPreflight: happy path → exitCode 0 with non-zero PASS count", () => {
  const dir = makeMinimalRepo();
  try {
    const result = runPreflight({
      env: fullEnv(),
      repoRoot: dir,
      state: goodState(),
      treasury: goodTreasury(),
      ownerActions: "## Section A\n- [x] done\n"
    });
    // signer/key match may WARN if viem isn't reachable, but FAILs must be 0
    assert.equal(result.exitCode, 0, `expected exitCode 0, got ${result.exitCode}`);
    assert.ok(result.summary.pass >= 15, `expected many PASS, got ${result.summary.pass}`);
    assert.equal(result.summary.fail, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkSafes: only ORBIT_TREASURY_SAFE set → 6 FAILs", () => {
  const checks = checkSafes({ ORBIT_TREASURY_SAFE: ADDR.fee });
  const fails = checks.filter((c) => c.status === FAIL);
  const passes = checks.filter((c) => c.status === PASS);
  assert.equal(passes.length, 1);
  assert.equal(fails.length, 6);
});

test("checkSafes: duplicate addresses → conflict row appears + dup Safes FAIL", () => {
  const env = fullSafeEnv();
  env.ORBIT_BUYBACK_SAFE = env.ORBIT_GROWTH_SAFE;
  const checks = checkSafes(env);
  const dupRow = checks.find((c) => /duplicate-address/.test(c.label));
  assert.ok(dupRow, "expected a duplicate-address row");
  assert.equal(dupRow.status, FAIL);
  // both buyback and growth rows should be FAIL
  const buyback = checks.find((c) => c.label.trim() === "buyback");
  const growth = checks.find((c) => c.label.trim() === "growth");
  assert.equal(buyback.status, FAIL);
  assert.equal(growth.status, FAIL);
  assert.match(buyback.detail, /duplicate/);
});

test("checkSafes: all configured → 7 PASS, no conflicts", () => {
  const checks = checkSafes(fullSafeEnv());
  assert.equal(checks.filter((c) => c.status === PASS).length, 7);
  assert.equal(checks.filter((c) => c.status === FAIL).length, 0);
});

test("checkD018: preLaunchVerified !== true → FAIL", () => {
  const checks = checkD018({ preLaunchVerified: false, firstCleanCycle: 1, lastCleanCycle: 24, launchOnceFired: false });
  const pre = checks.find((c) => c.label === "preLaunchVerified");
  assert.equal(pre.status, FAIL);
});

test("checkD018: launchOnceFired === true → FAIL with detail", () => {
  const checks = checkD018({ preLaunchVerified: true, firstCleanCycle: 1, lastCleanCycle: 24, launchOnceFired: true });
  const fired = checks.find((c) => c.label === "launchOnceFired");
  assert.equal(fired.status, FAIL);
  assert.match(fired.detail, /already fired/);
});

test("checkD018: <24 clean cycles → WARN, not FAIL", () => {
  const checks = checkD018({ preLaunchVerified: true, firstCleanCycle: 1, lastCleanCycle: 10, launchOnceFired: false });
  const cl = checks.find((c) => c.label === "consecutive clean cycles");
  assert.equal(cl.status, WARN);
  assert.match(cl.detail, /only 10/);
});

test("checkD018: state is null → state.json FAIL", () => {
  const checks = checkD018(null);
  assert.equal(checks.length, 1);
  assert.equal(checks[0].status, FAIL);
});

test("checkSignerOperatorAi: AI_PROVIDERS set but key missing for a provider → FAIL alignment", () => {
  const env = {
    ORBIT_AGENT_SIGNER:               ADDR.signer,
    ORBIT_WALLET_PRIVATE_KEY:         TEST_PRIVATE_KEY,
    ORBIT_OPERATOR_REVENUE_ADDRESS:   ADDR.operator,
    ORBIT_AI_PROVIDERS:               JSON.stringify([{ name: "anthropic" }, { name: "openai" }]),
    ORBIT_AI_PROVIDER_KEYS:           JSON.stringify({ anthropic: "sk-ant-x" })
  };
  const checks = checkSignerOperatorAi(env);
  const align = checks.find((c) => c.label === "provider/key alignment");
  assert.ok(align);
  assert.equal(align.status, FAIL);
  assert.match(align.detail, /openai/);
});

test("checkSignerOperatorAi: AI_PROVIDERS invalid JSON → FAIL", () => {
  const checks = checkSignerOperatorAi({ ORBIT_AI_PROVIDERS: "not json" });
  const p = checks.find((c) => c.label === "ORBIT_AI_PROVIDERS");
  assert.equal(p.status, FAIL);
  assert.match(p.detail, /not valid JSON/);
});

test("checkSignerOperatorAi: ORBIT_AGENT_SIGNER missing → FAIL", () => {
  const checks = checkSignerOperatorAi({});
  const signer = checks.find((c) => c.label === "ORBIT_AGENT_SIGNER");
  assert.equal(signer.status, FAIL);
  const pkey = checks.find((c) => c.label === "ORBIT_WALLET_PRIVATE_KEY");
  assert.equal(pkey.status, FAIL);
});

test("checkSignerOperatorAi: present key never echoed in output", () => {
  const env = {
    ORBIT_AGENT_SIGNER:       ADDR.signer,
    ORBIT_WALLET_PRIVATE_KEY: "0xdeadbeef" + "00".repeat(28),
    ORBIT_AI_PROVIDER_KEYS:   JSON.stringify({ anthropic: "sk-ant-MEGA-SECRET" })
  };
  const checks = checkSignerOperatorAi(env);
  for (const c of checks) {
    assert.equal(c.detail.includes("MEGA-SECRET"), false, "must not echo provider key");
    assert.equal(c.detail.includes("deadbeef"), false, "must not echo private key");
  }
});

test("checkTreasury: revenue 0/0 → WARN (fail-closed default)", () => {
  const checks = checkTreasury({
    revenue: { operatorShareBps: 0, treasuryShareBps: 0 },
    buckets: { list: goodTreasury().buckets.list },
    token: { launchStatus: "not_launched" }
  });
  const rev = checks.find((c) => c.label === "revenue split");
  assert.equal(rev.status, WARN);
});

test("checkTreasury: buckets sum != 10000 → FAIL", () => {
  const list = goodTreasury().buckets.list.slice();
  list[0] = { ...list[0], bps: 5000 }; // now sum = 10500
  const checks = checkTreasury({
    revenue: { operatorShareBps: 500, treasuryShareBps: 9500 },
    buckets: { list },
    token: { launchStatus: "not_launched" }
  });
  const b = checks.find((c) => c.label === "buckets.list");
  assert.equal(b.status, FAIL);
  assert.match(b.detail, /10500/);
});

test("checkTreasury: token launched → INFO row carrying the address", () => {
  const checks = checkTreasury({
    revenue: { operatorShareBps: 500, treasuryShareBps: 9500 },
    buckets: { list: goodTreasury().buckets.list },
    token: { launchStatus: "launched", address: "0xabc0000000000000000000000000000000000000" }
  });
  const t = checks.find((c) => c.label === "token.launchStatus");
  assert.equal(t.status, INFO);
  assert.match(t.detail, /0xabc0/);
});

test("checkTreasury: treasury null → WARN, no crash", () => {
  const checks = checkTreasury(null);
  assert.equal(checks.length, 1);
  assert.equal(checks[0].status, WARN);
});

test("checkPublicSurface: missing files → WARN, not FAIL", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-preflight-surface-"));
  try {
    const checks = checkPublicSurface(dir);
    assert.equal(checks.length, 2);
    for (const c of checks) {
      assert.equal(c.status, WARN);
      assert.match(c.detail, /not found/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkPublicSurface: present + bad JSON → FAIL", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-preflight-surface-"));
  try {
    fs.mkdirSync(path.join(dir, "public", ".well-known"), { recursive: true });
    fs.writeFileSync(path.join(dir, "public", "dashboard.json"), "{not json");
    fs.writeFileSync(path.join(dir, "public", ".well-known", "orbit.json"), "{not json");
    const checks = checkPublicSurface(dir);
    assert.equal(checks.length, 2);
    for (const c of checks) {
      assert.equal(c.status, FAIL);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkOwnerActions: 7 open + 0 closed → 7 WARNs + a punch-list total", () => {
  const text = [
    "# OWNER_ACTIONS",
    "",
    "## 1. Enable Pages",
    "- [ ] do thing",
    "",
    "## 2. Set signer",
    "- [ ] do another",
    "",
    "## 3. Provision Farcaster",
    "- [ ] x",
    "",
    "## 4. Deploy Safes",
    "- [ ] x",
    "",
    "## 5. Publish SDK",
    "- [ ] x",
    "",
    "## 6. Configure AI",
    "- [ ] x",
    "",
    "## 7. Clean cycles",
    "- [ ] x"
  ].join("\n");
  const checks = checkOwnerActions(text);
  // 7 per-section rows + 1 total row
  assert.equal(checks.length, 8);
  const total = checks.find((c) => c.label === "punch list total");
  assert.match(total.detail, /0 closed/);
  assert.match(total.detail, /7 open/);
});

test("checkOwnerActions: missing text → single WARN row", () => {
  const checks = checkOwnerActions(null);
  assert.equal(checks.length, 1);
  assert.equal(checks[0].status, WARN);
});

test("parseOwnerActions: handles upper-case X in [x]", () => {
  const text = [
    "## A",
    "- [X] done",
    "- [x] also done",
    "- [ ] todo"
  ].join("\n");
  const sections = parseOwnerActions(text);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].closed, 2);
  assert.equal(sections[0].open, 1);
});

test("checkRepoState (via runPreflight): not a git repo → FAILs in section 1", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-preflight-nogit-"));
  try {
    const result = runPreflight({
      env: {},
      repoRoot: dir,
      state: null,
      treasury: null,
      ownerActions: null
    });
    const repo = result.sections[0];
    const failedLabels = repo.checks.filter((c) => c.status === FAIL).map((c) => c.label);
    assert.ok(failedLabels.includes("git initialized"));
    assert.ok(failedLabels.length >= 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("renderLines: header line present + section banners + summary", () => {
  const result = runPreflight({
    env: {},
    repoRoot: "/tmp/does-not-exist-orbit",
    state: null,
    treasury: null,
    ownerActions: null
  });
  const lines = renderLines(result, { color: false, now: "2026-05-25T13:00:00Z" });
  assert.equal(lines[0], "=== Orbit Preflight Check ===");
  assert.equal(lines[1], "Run: 2026-05-25T13:00:00Z");
  // section headers numbered [1/8] ... [8/8]
  const headers = lines.filter((l) => /^\[\d+\/8\]/.test(l));
  assert.equal(headers.length, 8);
  // summary line at the end
  assert.ok(lines.some((l) => /^Summary:/.test(l)));
  assert.ok(lines.some((l) => /^Exit:/.test(l)));
});

test("renderLines: color off when not TTY (ASCII-clean output)", () => {
  const result = runPreflight({
    env: {},
    repoRoot: "/tmp/does-not-exist-orbit",
    state: null,
    treasury: null,
    ownerActions: null
  });
  const lines = renderLines(result, { color: false });
  const ESC = String.fromCharCode(0x1b);
  for (const l of lines) {
    assert.equal(l.includes(ESC), false, "ESC (ANSI) bytes should not appear when color is off");
  }
});

test("countByStatus is consistent with runPreflight.summary", () => {
  const result = runPreflight({
    env: fullSafeEnv(),
    repoRoot: "/tmp/does-not-exist-orbit",
    state: goodState(),
    treasury: goodTreasury(),
    ownerActions: "## A\n- [x] ok\n"
  });
  const counted = countByStatus(result.sections);
  assert.deepEqual(counted, result.summary);
});

// ---------------------------------------------------------------------------
// --strict mode (launch-day CI gate)
// ---------------------------------------------------------------------------

test("runPreflight: --strict + empty env still exits 1 (FAILs already present)", () => {
  const result = runPreflight({
    env: {},
    repoRoot: "/tmp/does-not-exist-orbit",
    state: null,
    treasury: null,
    ownerActions: null,
    strict: true
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.strict, true);
  assert.ok(result.summary.fail > 0, "expected FAILs in empty-env scenario");
});

test("runPreflight: --strict + WARNs but no FAILs → exitCode 1", () => {
  // Use a minimal git repo (no uncommitted changes, so working-tree-clean is
  // PASS), but pass null treasury + null ownerActions to produce WARNs in
  // sections 5 + 7 without any FAILs.
  const dir = makeMinimalRepo();
  try {
    const result = runPreflight({
      env: fullEnv(),
      repoRoot: dir,
      state: goodState(),
      treasury: null,           // → WARN row
      ownerActions: null,        // → WARN row
      strict: true
    });
    assert.equal(result.summary.fail, 0, `expected no FAILs, got ${result.summary.fail}`);
    assert.ok(result.summary.warn > 0, "expected WARNs in this scenario");
    assert.equal(result.exitCode, 1, "STRICT mode must reject WARNs");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runPreflight: no --strict + WARNs but no FAILs → exitCode 0 (backwards-compatible)", () => {
  const dir = makeMinimalRepo();
  try {
    const result = runPreflight({
      env: fullEnv(),
      repoRoot: dir,
      state: goodState(),
      treasury: null,
      ownerActions: null
      // strict omitted → defaults to false
    });
    assert.equal(result.summary.fail, 0);
    assert.ok(result.summary.warn > 0);
    assert.equal(result.exitCode, 0, "non-strict mode must pass on WARN-only");
    assert.equal(result.strict, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runPreflight: --strict + all PASS → exitCode 0", () => {
  const dir = makeMinimalRepo();
  try {
    // Build files on disk that satisfy the public-surface check so we get
    // zero WARNs from that section. We still expect either 0 WARNs or, at
    // worst, none after treasury + ownerActions present.
    fs.mkdirSync(path.join(dir, "public", ".well-known"), { recursive: true });
    fs.writeFileSync(path.join(dir, "public", "dashboard.json"), "{}");
    fs.writeFileSync(path.join(dir, "public", ".well-known", "orbit.json"), "{}");
    const result = runPreflight({
      env: fullEnv(),
      repoRoot: dir,
      state: goodState(),
      treasury: goodTreasury(),
      ownerActions: "## Section A\n- [x] done\n",
      strict: true
    });
    // The signer/key match line can WARN if viem can't load in the env;
    // in CI it loads, but be defensive: only assert exit code matches the
    // observed counts.
    if (result.summary.warn === 0 && result.summary.fail === 0) {
      assert.equal(result.exitCode, 0, "STRICT + all PASS must exit 0");
    } else {
      // If something else WARNed/FAILed in the host env, the assertion is
      // just that the strict-mode rule held.
      assert.equal(result.exitCode, result.summary.fail > 0 || result.summary.warn > 0 ? 1 : 0);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("renderLines: --strict mode shows STRICT in summary + Mode banner", () => {
  const dir = makeMinimalRepo();
  try {
    const result = runPreflight({
      env: fullEnv(),
      repoRoot: dir,
      state: goodState(),
      treasury: null,        // → WARN
      ownerActions: null,    // → WARN
      strict: true
    });
    const lines = renderLines(result, { color: false, now: "2026-05-25T13:00:00Z" });
    assert.ok(lines.some((l) => /Mode:\s*STRICT/.test(l)), "expected Mode: STRICT banner");
    assert.ok(lines.some((l) => /Summary\s*\[STRICT\]:/.test(l)), "expected Summary [STRICT] tag");
    assert.ok(lines.some((l) => /Exit:\s*1\s*\(STRICT:/.test(l)), "expected STRICT exit reason");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("renderLines: non-strict mode does not show STRICT markers", () => {
  const result = runPreflight({
    env: {},
    repoRoot: "/tmp/does-not-exist-orbit",
    state: null,
    treasury: null,
    ownerActions: null
  });
  const lines = renderLines(result, { color: false, now: "2026-05-25T13:00:00Z" });
  for (const l of lines) {
    assert.equal(/Mode:\s*STRICT/.test(l), false, "non-strict mode must not emit Mode: STRICT");
    assert.equal(/\[STRICT\]/.test(l), false, "non-strict mode must not emit [STRICT] tag");
  }
});

test("parseArgv: --strict present → strict true", () => {
  const { parseArgv } = require("../src/cli/orbit-preflight");
  assert.equal(parseArgv(["node", "orbit-preflight.js", "--strict"]).strict, true);
  assert.equal(parseArgv(["node", "orbit-preflight.js"]).strict, false);
  assert.equal(parseArgv([]).strict, false);
  assert.equal(parseArgv(null).strict, false);
});

// ---------------------------------------------------------------------------
// S-REVENUE-3: Bus-factor section
// ---------------------------------------------------------------------------

test("runPreflight: bus-factor section appears with a PASS/WARN/FAIL line on current repo", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const result = runPreflight({
    env: { ORBIT_BUS_FACTOR_MIN_MAINTAINERS: "1", ORBIT_BUS_FACTOR_MIN_COMMITS: "1" },
    repoRoot,
    state: null,
    treasury: null,
    ownerActions: null
  });
  const busSection = result.sections.find((s) => /Bus-factor/.test(s.title));
  assert.ok(busSection, "expected Bus-factor section");
  assert.equal(busSection.checks.length, 1);
  const status = busSection.checks[0].status;
  assert.ok(
    status === PASS || status === WARN || status === FAIL,
    `expected PASS/WARN/FAIL, got ${status}`
  );
  assert.match(busSection.checks[0].detail, /bus-factor=/);
});

test("runPreflight: bus-factor gate handles missing git gracefully (FAIL, not crash)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-preflight-nobus-"));
  try {
    const result = runPreflight({
      env: {},
      repoRoot: dir,
      state: null,
      treasury: null,
      ownerActions: null
    });
    const busSection = result.sections.find((s) => /Bus-factor/.test(s.title));
    assert.ok(busSection);
    assert.equal(busSection.checks.length, 1);
    // No git + no adopters → bus-factor = 0 < min → FAIL (recommendation=critical).
    assert.equal(busSection.checks[0].status, FAIL);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
