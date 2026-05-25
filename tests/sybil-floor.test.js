"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_MAX_CONCENTRATION_BPS,
  DEFAULT_MIN_UNIQUE_FUNDERS,
  DEFAULT_MIN_WALLET_AGE_DAYS,
  assertSybilFloorMet,
  checkWalletAge,
  evaluateFunders,
  loadConfig,
  maxConcentration,
  summarizeFunders,
  uniqueAddresses
} = require("../src/agent/sybil-floor");

// Deterministic clock used across age-sensitive tests.
const NOW = new Date("2026-05-25T00:00:00Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Helper: build a `firstSeenAt` ISO string N days before NOW.
function daysAgo(n) {
  return new Date(NOW.getTime() - n * MS_PER_DAY).toISOString();
}

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

test("constants: defaults are 30 days / 3 funders / 5000 bps", () => {
  assert.equal(DEFAULT_MIN_WALLET_AGE_DAYS, 30);
  assert.equal(DEFAULT_MIN_UNIQUE_FUNDERS, 3);
  assert.equal(DEFAULT_MAX_CONCENTRATION_BPS, 5000);
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

test("loadConfig: empty env returns defaults", () => {
  const cfg = loadConfig({});
  assert.deepEqual(cfg, {
    minWalletAgeDays: 30,
    minUniqueFunders: 3,
    maxConcentrationBps: 5000
  });
});

test("loadConfig: env overrides", () => {
  const cfg = loadConfig({
    ORBIT_SYBIL_MIN_WALLET_AGE_DAYS: "7",
    ORBIT_SYBIL_MIN_UNIQUE_FUNDERS: "5",
    ORBIT_SYBIL_MAX_CONCENTRATION_BPS: "3000"
  });
  assert.equal(cfg.minWalletAgeDays, 7);
  assert.equal(cfg.minUniqueFunders, 5);
  assert.equal(cfg.maxConcentrationBps, 3000);
});

test("loadConfig: invalid negative wallet age throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_SYBIL_MIN_WALLET_AGE_DAYS: "-1" }),
    /ORBIT_SYBIL_MIN_WALLET_AGE_DAYS/
  );
});

test("loadConfig: zero unique funders throws (min is 1)", () => {
  assert.throws(
    () => loadConfig({ ORBIT_SYBIL_MIN_UNIQUE_FUNDERS: "0" }),
    /ORBIT_SYBIL_MIN_UNIQUE_FUNDERS/
  );
});

test("loadConfig: concentration > 10000 throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_SYBIL_MAX_CONCENTRATION_BPS: "10001" }),
    /ORBIT_SYBIL_MAX_CONCENTRATION_BPS/
  );
});

test("loadConfig: concentration < 100 throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_SYBIL_MAX_CONCENTRATION_BPS: "99" }),
    /ORBIT_SYBIL_MAX_CONCENTRATION_BPS/
  );
});

test("loadConfig: wallet age > 365 throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_SYBIL_MIN_WALLET_AGE_DAYS: "366" }),
    /ORBIT_SYBIL_MIN_WALLET_AGE_DAYS/
  );
});

test("loadConfig: non-integer env throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_SYBIL_MIN_UNIQUE_FUNDERS: "three" }),
    /ORBIT_SYBIL_MIN_UNIQUE_FUNDERS/
  );
});

// ---------------------------------------------------------------------------
// uniqueAddresses
// ---------------------------------------------------------------------------

test("uniqueAddresses: lowercase-dedupes mixed case", () => {
  const set = uniqueAddresses([
    { address: "0xABCDEF0000000000000000000000000000000001", amountWei: "1" },
    { address: "0xabcdef0000000000000000000000000000000001", amountWei: "2" },
    { address: "0xAbCdEf0000000000000000000000000000000001", amountWei: "3" }
  ]);
  assert.equal(set.size, 1);
  assert.ok(set.has("0xabcdef0000000000000000000000000000000001"));
});

test("uniqueAddresses: null/undefined input returns empty set", () => {
  assert.equal(uniqueAddresses(null).size, 0);
  assert.equal(uniqueAddresses(undefined).size, 0);
});

test("uniqueAddresses: skips malformed rows", () => {
  const set = uniqueAddresses([
    null,
    {},
    { address: 123 },
    { address: "" },
    { address: "0xAaa0000000000000000000000000000000000001" }
  ]);
  assert.equal(set.size, 1);
});

// ---------------------------------------------------------------------------
// maxConcentration
// ---------------------------------------------------------------------------

test("maxConcentration: empty list -> 0", () => {
  assert.equal(maxConcentration([]), 0);
  assert.equal(maxConcentration(null), 0);
});

test("maxConcentration: all from one address -> 10000", () => {
  assert.equal(
    maxConcentration([
      { address: "0xaaa0000000000000000000000000000000000001", amountWei: "1000000000000000000" }
    ]),
    10000
  );
});

test("maxConcentration: even 4-way split -> 2500", () => {
  const funders = [
    { address: "0xa1", amountWei: "1000" },
    { address: "0xa2", amountWei: "1000" },
    { address: "0xa3", amountWei: "1000" },
    { address: "0xa4", amountWei: "1000" }
  ];
  assert.equal(maxConcentration(funders), 2500);
});

test("maxConcentration: one big + three small", () => {
  // 8000 + 3*1000 = 11000 total; max = 8000 -> 7272 bps
  const funders = [
    { address: "0xa1", amountWei: "8000" },
    { address: "0xa2", amountWei: "1000" },
    { address: "0xa3", amountWei: "1000" },
    { address: "0xa4", amountWei: "1000" }
  ];
  assert.equal(maxConcentration(funders), 7272);
});

test("maxConcentration: aggregates same-address rows before measuring", () => {
  // Same address contributes 7000 across two rows, total = 10000 -> 7000 bps.
  const funders = [
    { address: "0xAAA", amountWei: "4000" },
    { address: "0xaaa", amountWei: "3000" },
    { address: "0xbbb", amountWei: "3000" }
  ];
  assert.equal(maxConcentration(funders), 7000);
});

// ---------------------------------------------------------------------------
// checkWalletAge
// ---------------------------------------------------------------------------

test("checkWalletAge: missing firstSeenAt -> fail no_first_seen_data", () => {
  const r = checkWalletAge({ address: "0xa" }, 30, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.ageDays, 0);
  assert.equal(r.reason, "no_first_seen_data");
});

test("checkWalletAge: unparseable firstSeenAt -> fail no_first_seen_data", () => {
  const r = checkWalletAge({ address: "0xa", firstSeenAt: "not-a-date" }, 30, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no_first_seen_data");
});

test("checkWalletAge: exactly minAgeDays -> ok", () => {
  const r = checkWalletAge({ address: "0xa", firstSeenAt: daysAgo(30) }, 30, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.ageDays, 30);
  assert.equal(r.reason, undefined);
});

test("checkWalletAge: one day under minAgeDays -> fail wallet_too_young", () => {
  const r = checkWalletAge({ address: "0xa", firstSeenAt: daysAgo(29) }, 30, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.ageDays, 29);
  assert.equal(r.reason, "wallet_too_young");
});

test("checkWalletAge: far older -> ok", () => {
  const r = checkWalletAge({ address: "0xa", firstSeenAt: daysAgo(400) }, 30, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.ageDays, 400);
});

// ---------------------------------------------------------------------------
// evaluateFunders
// ---------------------------------------------------------------------------

test("evaluateFunders: happy path (3 balanced old funders) -> ok", () => {
  const funders = [
    { address: "0xa1", amountWei: "1000", firstSeenAt: daysAgo(120) },
    { address: "0xa2", amountWei: "1000", firstSeenAt: daysAgo(90) },
    { address: "0xa3", amountWei: "1000", firstSeenAt: daysAgo(60) }
  ];
  const r = evaluateFunders(funders, {}, { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.uniqueCount, 3);
  assert.equal(r.minUniqueRequired, 3);
  assert.equal(r.concentrationBps, 3333); // floor of 10000/3
  assert.equal(r.maxConcentrationAllowed, 5000);
  assert.equal(r.failures.length, 0);
  assert.ok(r.walletAgeChecks.every((c) => c.ok));
});

test("evaluateFunders: too few unique -> fail too_few_unique", () => {
  const funders = [
    { address: "0xa1", amountWei: "1000", firstSeenAt: daysAgo(120) },
    { address: "0xa2", amountWei: "1000", firstSeenAt: daysAgo(90) }
  ];
  const r = evaluateFunders(funders, {}, { now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.uniqueCount, 2);
  assert.ok(r.failures.includes("too_few_unique"));
});

test("evaluateFunders: too concentrated -> fail too_concentrated", () => {
  // 9000 + 500 + 500 = 10000; top = 9000 -> 9000 bps > 5000
  const funders = [
    { address: "0xa1", amountWei: "9000", firstSeenAt: daysAgo(120) },
    { address: "0xa2", amountWei: "500", firstSeenAt: daysAgo(90) },
    { address: "0xa3", amountWei: "500", firstSeenAt: daysAgo(60) }
  ];
  const r = evaluateFunders(funders, {}, { now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.concentrationBps, 9000);
  assert.ok(r.failures.includes("too_concentrated"));
});

test("evaluateFunders: one young wallet -> fail young_wallets", () => {
  const funders = [
    { address: "0xa1", amountWei: "1000", firstSeenAt: daysAgo(120) },
    { address: "0xa2", amountWei: "1000", firstSeenAt: daysAgo(90) },
    { address: "0xa3", amountWei: "1000", firstSeenAt: daysAgo(3) }
  ];
  const r = evaluateFunders(funders, {}, { now: NOW });
  assert.equal(r.ok, false);
  const youngEntry = r.failures.find((f) => f.startsWith("young_wallets:"));
  assert.ok(youngEntry);
  assert.ok(youngEntry.includes("0xa3"));
});

test("evaluateFunders: multiple failures combine", () => {
  // 2 unique, one is young, and 9500/10000 concentration.
  const funders = [
    { address: "0xa1", amountWei: "9500", firstSeenAt: daysAgo(120) },
    { address: "0xa2", amountWei: "500", firstSeenAt: daysAgo(3) }
  ];
  const r = evaluateFunders(funders, {}, { now: NOW });
  assert.equal(r.ok, false);
  assert.ok(r.failures.includes("too_few_unique"));
  assert.ok(r.failures.includes("too_concentrated"));
  assert.ok(r.failures.some((f) => f.startsWith("young_wallets:")));
});

test("evaluateFunders: null/empty funders -> uniqueCount 0, not ok", () => {
  const r1 = evaluateFunders(null, {}, { now: NOW });
  assert.equal(r1.ok, false);
  assert.equal(r1.uniqueCount, 0);
  const r2 = evaluateFunders([], {}, { now: NOW });
  assert.equal(r2.ok, false);
  assert.equal(r2.uniqueCount, 0);
});

test("evaluateFunders: env override loosens unique requirement", () => {
  const funders = [
    { address: "0xa1", amountWei: "1000", firstSeenAt: daysAgo(120) }
  ];
  const r = evaluateFunders(
    funders,
    { ORBIT_SYBIL_MIN_UNIQUE_FUNDERS: "1", ORBIT_SYBIL_MAX_CONCENTRATION_BPS: "10000" },
    { now: NOW }
  );
  assert.equal(r.ok, true);
  assert.equal(r.minUniqueRequired, 1);
});

// ---------------------------------------------------------------------------
// assertSybilFloorMet
// ---------------------------------------------------------------------------

test("assertSybilFloorMet: returns evaluation on success", () => {
  const funders = [
    { address: "0xa1", amountWei: "1000", firstSeenAt: daysAgo(120) },
    { address: "0xa2", amountWei: "1000", firstSeenAt: daysAgo(90) },
    { address: "0xa3", amountWei: "1000", firstSeenAt: daysAgo(60) }
  ];
  const r = assertSybilFloorMet(funders, {}, { now: NOW });
  assert.equal(r.ok, true);
});

test("assertSybilFloorMet: throws structured error on fail", () => {
  let caught;
  try {
    assertSybilFloorMet(
      [{ address: "0xa1", amountWei: "1000", firstSeenAt: daysAgo(120) }],
      {},
      { now: NOW }
    );
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof Error);
  assert.equal(caught.code, "SYBIL_FLOOR_NOT_MET");
  assert.equal(typeof caught.message, "string");
  assert.ok(caught.message.includes("Sybil floor not met"));
  assert.equal(typeof caught.details, "object");
  assert.equal(caught.details.ok, false);
  assert.ok(Array.isArray(caught.details.failures));
});

// ---------------------------------------------------------------------------
// summarizeFunders
// ---------------------------------------------------------------------------

test("summarizeFunders: per-threshold booleans correct for happy path", () => {
  const funders = [
    { address: "0xa1", amountWei: "1000", firstSeenAt: daysAgo(120) },
    { address: "0xa2", amountWei: "1000", firstSeenAt: daysAgo(90) },
    { address: "0xa3", amountWei: "1000", firstSeenAt: daysAgo(60) }
  ];
  const s = summarizeFunders(funders, {});
  assert.equal(s.total, 3);
  assert.equal(s.uniqueCount, 3);
  assert.equal(s.concentrationBps, 3333);
  assert.equal(s.thresholdsMet.unique, true);
  assert.equal(s.thresholdsMet.concentration, true);
  // walletAge threshold uses real now() which is well past 2026-05-25 fixtures;
  // since 120/90/60 days ago from NOW is also >30, but summarizeFunders uses
  // wall-clock now. The fixture dates are set relative to NOW (a fixed point),
  // so wall-clock could be later — still >30 days old. This stays robust.
  assert.equal(s.thresholdsMet.walletAge, true);
  assert.equal(s.totalAmountWei, "3000");
});

test("summarizeFunders: flags failing thresholds without throwing", () => {
  const funders = [
    { address: "0xa1", amountWei: "9500", firstSeenAt: daysAgo(120) },
    { address: "0xa2", amountWei: "500" } // missing firstSeenAt
  ];
  const s = summarizeFunders(funders, {});
  assert.equal(s.total, 2);
  assert.equal(s.uniqueCount, 2);
  assert.equal(s.thresholdsMet.unique, false);
  assert.equal(s.thresholdsMet.concentration, false);
  assert.equal(s.thresholdsMet.walletAge, false);
  assert.equal(s.totalAmountWei, "10000");
});
