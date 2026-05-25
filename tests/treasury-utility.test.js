"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const treasuryUtility = require("../src/agent/treasury-utility");

const {
  DEFAULT_RATIO_CAP,
  DEFAULT_REBATE_TARGET,
  DEFAULT_WINDOW_DAYS,
  computeRatio,
  isRatioOverCap,
  loadConfig,
  proposeRebate,
  rollingSpendWei,
  summarizeUtility,
  treasuryHoldingsWei
} = treasuryUtility;

const ONE_ETH = 10n ** 18n;
const NOW_ISO = "2026-05-25T12:00:00.000Z";
const NOW = new Date(NOW_ISO);

function daysAgoIso(days, base) {
  const baseMs = (base instanceof Date ? base : new Date(base || NOW_ISO)).getTime();
  return new Date(baseMs - days * 86400000).toISOString();
}

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

test("loadConfig: defaults when env is empty", () => {
  const cfg = loadConfig({});
  assert.equal(cfg.ratioCap, DEFAULT_RATIO_CAP);
  assert.equal(cfg.windowDays, DEFAULT_WINDOW_DAYS);
  assert.equal(cfg.rebateTarget, DEFAULT_REBATE_TARGET);
});

test("loadConfig: env overrides apply", () => {
  const cfg = loadConfig({
    ORBIT_TREASURY_UTILITY_CAP: "8",
    ORBIT_TREASURY_UTILITY_WINDOW_DAYS: "30",
    ORBIT_TREASURY_UTILITY_REBATE_TARGET: "split"
  });
  assert.equal(cfg.ratioCap, 8);
  assert.equal(cfg.windowDays, 30);
  assert.equal(cfg.rebateTarget, "split");
});

test("loadConfig: rejects ratioCap below 2", () => {
  assert.throws(
    () => loadConfig({ ORBIT_TREASURY_UTILITY_CAP: "1" }),
    /ORBIT_TREASURY_UTILITY_CAP/
  );
});

test("loadConfig: rejects ratioCap above 20", () => {
  assert.throws(
    () => loadConfig({ ORBIT_TREASURY_UTILITY_CAP: "21" }),
    /ORBIT_TREASURY_UTILITY_CAP/
  );
});

test("loadConfig: rejects windowDays below 7", () => {
  assert.throws(
    () => loadConfig({ ORBIT_TREASURY_UTILITY_WINDOW_DAYS: "6" }),
    /ORBIT_TREASURY_UTILITY_WINDOW_DAYS/
  );
});

test("loadConfig: rejects windowDays above 365", () => {
  assert.throws(
    () => loadConfig({ ORBIT_TREASURY_UTILITY_WINDOW_DAYS: "366" }),
    /ORBIT_TREASURY_UTILITY_WINDOW_DAYS/
  );
});

test("loadConfig: rejects bad rebateTarget", () => {
  assert.throws(
    () => loadConfig({ ORBIT_TREASURY_UTILITY_REBATE_TARGET: "burn" }),
    /ORBIT_TREASURY_UTILITY_REBATE_TARGET/
  );
});

// ---------------------------------------------------------------------------
// rollingSpendWei
// ---------------------------------------------------------------------------

test("rollingSpendWei: empty treasury returns 0n", () => {
  assert.equal(rollingSpendWei({}, 90, NOW), 0n);
  assert.equal(rollingSpendWei(null, 90, NOW), 0n);
  assert.equal(rollingSpendWei({ ai: {} }, 90, NOW), 0n);
});

test("rollingSpendWei: AI ledger entries inside window are summed via USD->wei", () => {
  // 1 USD scaled to 1e18 wei. So estimatedUsd of 0.5 -> 5e17 wei.
  const treasury = {
    ai: {
      ledger: [
        { timestamp: daysAgoIso(1, NOW), estimatedUsd: 0.5 },
        { timestamp: daysAgoIso(10, NOW), estimatedUsd: 0.5 }
      ]
    }
  };
  const total = rollingSpendWei(treasury, 90, NOW);
  // 0.5 + 0.5 = 1 USD = 1e18 wei.
  assert.equal(total, ONE_ETH);
});

test("rollingSpendWei: AI entries outside window are excluded", () => {
  const treasury = {
    ai: {
      ledger: [
        { timestamp: daysAgoIso(5, NOW), estimatedUsd: 0.5 },
        { timestamp: daysAgoIso(180, NOW), estimatedUsd: 999 } // way outside
      ]
    }
  };
  const total = rollingSpendWei(treasury, 90, NOW);
  assert.equal(total, 5n * 10n ** 17n);
});

test("rollingSpendWei: mixed sources (ai + expenses + stream gas)", () => {
  const treasury = {
    ai: {
      recentUsage: [
        { timestamp: daysAgoIso(2, NOW), costWei: "1000000000000000000" } // 1 ETH
      ]
    },
    expenses: [
      { timestamp: daysAgoIso(3, NOW), amountWei: "500000000000000000" } // 0.5 ETH
    ],
    revenue: {
      streams: [
        {
          id: "demo",
          lastClaim: {
            ts: daysAgoIso(4, NOW),
            kind: "spend",
            spendWei: "250000000000000000" // 0.25 ETH gas
          }
        },
        {
          id: "no-tag",
          lastClaim: {
            // No tag -> NOT counted (revenue inflow).
            ts: daysAgoIso(4, NOW),
            spendWei: "99999000000000000000"
          }
        }
      ]
    }
  };
  const total = rollingSpendWei(treasury, 90, NOW);
  assert.equal(total, ONE_ETH + 5n * 10n ** 17n + 25n * 10n ** 16n);
});

// ---------------------------------------------------------------------------
// treasuryHoldingsWei
// ---------------------------------------------------------------------------

test("treasuryHoldingsWei: missing buckets returns 0n", () => {
  assert.equal(treasuryHoldingsWei({}), 0n);
  assert.equal(treasuryHoldingsWei({ buckets: {} }), 0n);
});

test("treasuryHoldingsWei: sums bucket list balances", () => {
  const treasury = {
    buckets: [
      { id: "a", balanceWei: "1000000000000000000" },
      { id: "b", balanceWei: "500000000000000000" },
      { id: "c", balanceWei: "0" }
    ]
  };
  assert.equal(treasuryHoldingsWei(treasury), ONE_ETH + 5n * 10n ** 17n);
});

test("treasuryHoldingsWei: falls back to totalHoldingsWei when buckets absent", () => {
  const treasury = { totalHoldingsWei: "2000000000000000000" };
  assert.equal(treasuryHoldingsWei(treasury), 2n * ONE_ETH);
});

test("treasuryHoldingsWei: supports buckets.list nested shape", () => {
  const treasury = {
    buckets: {
      list: [
        { id: "a", balanceWei: "3000000000000000000" }
      ]
    }
  };
  assert.equal(treasuryHoldingsWei(treasury), 3n * ONE_ETH);
});

// ---------------------------------------------------------------------------
// computeRatio
// ---------------------------------------------------------------------------

test("computeRatio: zero spend yields Infinity ratio and ok=false", () => {
  const treasury = {
    buckets: [{ balanceWei: ONE_ETH.toString() }]
  };
  const r = computeRatio(treasury, {}, { now: NOW });
  assert.equal(r.ratio, Infinity);
  assert.equal(r.ok, false);
  assert.equal(r.treasuryWei, ONE_ETH);
  assert.equal(r.spendWei, 0n);
});

test("computeRatio: normal case computes a finite ratio", () => {
  // 5 ETH treasury, 1 ETH (== 1 USD scaled) of spend over 90 days -> ratio 5.000
  const treasury = {
    buckets: [{ balanceWei: (5n * ONE_ETH).toString() }],
    ai: {
      ledger: [{ timestamp: daysAgoIso(10, NOW), estimatedUsd: 1 }]
    }
  };
  const r = computeRatio(treasury, {}, { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.treasuryWei, 5n * ONE_ETH);
  assert.equal(r.spendWei, ONE_ETH);
  assert.equal(r.ratio, 5);
});

test("computeRatio: very small spend produces a high ratio", () => {
  // 100 ETH treasury, ~0.01 USD of spend -> ratio ~10,000
  const treasury = {
    buckets: [{ balanceWei: (100n * ONE_ETH).toString() }],
    ai: {
      ledger: [{ timestamp: daysAgoIso(1, NOW), estimatedUsd: 0.01 }]
    }
  };
  const r = computeRatio(treasury, {}, { now: NOW });
  assert.equal(r.ok, true);
  assert.ok(r.ratio >= 9999 && r.ratio <= 10001, `ratio ${r.ratio} not near 10000`);
});

test("computeRatio: feeReceiveBalanceWei opt is added to treasuryWei", () => {
  const treasury = {
    buckets: [{ balanceWei: ONE_ETH.toString() }],
    ai: { ledger: [{ timestamp: daysAgoIso(1, NOW), estimatedUsd: 1 }] }
  };
  const r = computeRatio(treasury, {}, { now: NOW, feeReceiveBalanceWei: ONE_ETH });
  assert.equal(r.treasuryWei, 2n * ONE_ETH);
  assert.equal(r.ratio, 2);
});

// ---------------------------------------------------------------------------
// isRatioOverCap
// ---------------------------------------------------------------------------

test("isRatioOverCap: under cap returns false", () => {
  assert.equal(isRatioOverCap(3, {}), false);
});

test("isRatioOverCap: over cap returns true", () => {
  assert.equal(isRatioOverCap(7.5, {}), true);
});

test("isRatioOverCap: Infinity returns false (fail-safe)", () => {
  assert.equal(isRatioOverCap(Infinity, {}), false);
  assert.equal(isRatioOverCap(Number.NaN, {}), false);
});

test("isRatioOverCap: exactly at cap returns false", () => {
  assert.equal(isRatioOverCap(DEFAULT_RATIO_CAP, {}), false);
});

// ---------------------------------------------------------------------------
// proposeRebate
// ---------------------------------------------------------------------------

test("proposeRebate: no excess returns null proposalId", () => {
  // 4 ETH treasury, 1 USD = 1 ETH spend -> ratio 4 (cap is 5). No excess.
  const treasury = {
    buckets: [{ balanceWei: (4n * ONE_ETH).toString() }],
    ai: { ledger: [{ timestamp: daysAgoIso(2, NOW), estimatedUsd: 1 }] }
  };
  const report = computeRatio(treasury, {}, { now: NOW });
  const proposal = proposeRebate(treasury, report, {}, { now: NOW });
  assert.equal(proposal.proposalId, null);
  assert.equal(proposal.amountWei, "0");
  assert.deepEqual(proposal.targets, []);
  assert.equal(proposal.reason, "no_excess");
  assert.equal(proposal.needsOwnerApproval, false);
});

test("proposeRebate: excess produces proposal with right amount and operator default target", () => {
  // 10 ETH treasury, 1 USD spend, cap 5 -> excess = 10 - 5 = 5 ETH.
  const treasury = {
    buckets: [{ balanceWei: (10n * ONE_ETH).toString() }],
    ai: { ledger: [{ timestamp: daysAgoIso(2, NOW), estimatedUsd: 1 }] }
  };
  const report = computeRatio(treasury, {}, { now: NOW });
  const proposal = proposeRebate(treasury, report, {}, { now: NOW });
  assert.ok(proposal.proposalId);
  assert.match(proposal.proposalId, /^rebate-2026-05-25-[0-9a-f]{6}$/);
  assert.equal(proposal.amountWei, (5n * ONE_ETH).toString());
  assert.deepEqual(proposal.targets, [{ recipient: "operator", bps: 10000 }]);
  assert.equal(proposal.needsOwnerApproval, true);
  assert.match(proposal.reason, /ratio=10 > cap=5/);
});

test("proposeRebate: split target produces two entries", () => {
  const treasury = {
    buckets: [{ balanceWei: (10n * ONE_ETH).toString() }],
    ai: { ledger: [{ timestamp: daysAgoIso(2, NOW), estimatedUsd: 1 }] }
  };
  const env = { ORBIT_TREASURY_UTILITY_REBATE_TARGET: "split" };
  const report = computeRatio(treasury, env, { now: NOW });
  const proposal = proposeRebate(treasury, report, env, { now: NOW });
  assert.equal(proposal.targets.length, 2);
  assert.deepEqual(proposal.targets, [
    { recipient: "operator", bps: 5000 },
    { recipient: "growth-safe", bps: 5000 }
  ]);
});

test("proposeRebate: zero-spend produces no_excess (fail-safe)", () => {
  const treasury = { buckets: [{ balanceWei: (1000n * ONE_ETH).toString() }] };
  const report = computeRatio(treasury, {}, { now: NOW });
  const proposal = proposeRebate(treasury, report, {}, { now: NOW });
  assert.equal(proposal.proposalId, null);
  assert.equal(proposal.reason, "no_excess");
});

// ---------------------------------------------------------------------------
// summarizeUtility
// ---------------------------------------------------------------------------

test("summarizeUtility: recommendation is 'ok' at 50% of cap", () => {
  // ratio = 2.5 with default cap 5
  const treasury = {
    buckets: [{ balanceWei: (25n * 10n ** 17n).toString() }], // 2.5 ETH
    ai: { ledger: [{ timestamp: daysAgoIso(2, NOW), estimatedUsd: 1 }] }
  };
  const s = summarizeUtility(treasury, {}, { now: NOW });
  assert.equal(s.ratio, 2.5);
  assert.equal(s.recommendation, "ok");
  assert.equal(s.isOverCap, false);
  assert.equal(s.ratioCap, 5);
  assert.equal(s.approachingCapThreshold, 4);
});

test("summarizeUtility: recommendation is 'approaching_cap' at 85% of cap", () => {
  // ratio = 4.25 with default cap 5 -> approaching (>= 4)
  const treasury = {
    buckets: [{ balanceWei: (425n * 10n ** 16n).toString() }], // 4.25 ETH
    ai: { ledger: [{ timestamp: daysAgoIso(2, NOW), estimatedUsd: 1 }] }
  };
  const s = summarizeUtility(treasury, {}, { now: NOW });
  assert.equal(s.ratio, 4.25);
  assert.equal(s.recommendation, "approaching_cap");
  assert.equal(s.isOverCap, false);
});

test("summarizeUtility: recommendation is 'over_cap' at 120% of cap", () => {
  // ratio = 6.0 with default cap 5
  const treasury = {
    buckets: [{ balanceWei: (6n * ONE_ETH).toString() }],
    ai: { ledger: [{ timestamp: daysAgoIso(2, NOW), estimatedUsd: 1 }] }
  };
  const s = summarizeUtility(treasury, {}, { now: NOW });
  assert.equal(s.ratio, 6);
  assert.equal(s.recommendation, "over_cap");
  assert.equal(s.isOverCap, true);
});

test("summarizeUtility: zero spend yields ok (fail-safe)", () => {
  const treasury = { buckets: [{ balanceWei: (1000n * ONE_ETH).toString() }] };
  const s = summarizeUtility(treasury, {}, { now: NOW });
  assert.equal(s.ratio, Infinity);
  assert.equal(s.recommendation, "ok");
  assert.equal(s.isOverCap, false);
});
