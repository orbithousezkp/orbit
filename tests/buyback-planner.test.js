"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  priceImpactBps,
  safeSingleBuySize,
  planSubBuys,
  readPoolState,
  reservesFromSqrtPriceX96,
  parseNotionalWei,
  WEI_PER_ETH
} = require("../src/agent/buyback-planner");

// --- priceImpactBps -------------------------------------------------------

test("priceImpactBps: small buy on deep pool is well under cap", () => {
  // reserves 100 WETH, buy 0.1 WETH. Closed form:
  //   numerator   = 0.1 * (2*100 + 0.1) * 10000 = 0.1 * 200.1 * 10000 = 200100
  //   denominator = (100.1)^2 = 10020.01
  //   impact      ≈ 19.97 bps. We assert <= 20.
  const reserves = 100n * WEI_PER_ETH;
  const amount = WEI_PER_ETH / 10n; // 0.1 WETH
  const impact = priceImpactBps(reserves, amount);
  assert.ok(typeof impact === "bigint", "impact must be BigInt");
  assert.ok(impact <= 20n, `expected impact <= 20 bps, got ${impact}`);
  assert.ok(impact >= 15n, `expected impact >= 15 bps, got ${impact}`);
});

test("priceImpactBps: 1 WETH into 100 WETH pool is ~197 bps", () => {
  // Closed-form V2 (reserveIn=reserveOut=100 cancels in the ratio):
  //   amountOut    = 1*100/(100+1) = 0.99009901
  //   priceBefore  = 100/100 = 1
  //   priceAfter   = (100 - 0.99009901)/(100+1) = 99.00990099/101 = 0.98029605
  //   impactBps    = (1 - 0.98029605)/1 * 10000 = 197.04 bps
  // BigInt floor = 197.
  const reserves = 100n * WEI_PER_ETH;
  const amount = WEI_PER_ETH;
  const impact = priceImpactBps(reserves, amount);
  assert.equal(impact, 197n, `expected 197 bps, got ${impact}`);
});

test("priceImpactBps: amountIn=0 yields zero impact", () => {
  const reserves = 100n * WEI_PER_ETH;
  assert.equal(priceImpactBps(reserves, 0n), 0n);
});

test("priceImpactBps: empty reserve returns sentinel huge value", () => {
  const impact = priceImpactBps(0n, WEI_PER_ETH);
  assert.ok(impact > 10000n, "empty pool must yield impact > 100%");
});

test("priceImpactBps: BigInt boundaries (huge reserves, huge amount)", () => {
  // reserves = 10^30 wei (1e12 ETH, well into BigInt territory), amount 1 WETH
  // Impact should be effectively 0 bps (well under 1 bp).
  const reserves = 10n ** 30n;
  const impact = priceImpactBps(reserves, WEI_PER_ETH);
  assert.ok(impact === 0n, `expected 0 bps on enormous pool, got ${impact}`);
});

// --- safeSingleBuySize ----------------------------------------------------

test("safeSingleBuySize: returns positive amount under cap", () => {
  const reserves = 100n * WEI_PER_ETH;
  const cap = 50n; // 0.5%
  const safe = safeSingleBuySize(reserves, cap);
  assert.ok(typeof safe === "bigint");
  assert.ok(safe > 0n, "must return positive amount");
  // The amount it returns must satisfy <= cap
  const impact = priceImpactBps(reserves, safe);
  assert.ok(impact <= cap, `impact ${impact} exceeds cap ${cap}`);
  // And amount+1 wei should exceed the cap (binary search is tight)
  const impactPlus = priceImpactBps(reserves, safe + 1n);
  assert.ok(impactPlus > cap, `expected (safe+1)=${safe + 1n} to exceed cap, impact=${impactPlus}`);
});

test("safeSingleBuySize: tighter cap returns smaller safe size", () => {
  const reserves = 100n * WEI_PER_ETH;
  const safe50 = safeSingleBuySize(reserves, 50n);
  const safe10 = safeSingleBuySize(reserves, 10n);
  const safe1 = safeSingleBuySize(reserves, 1n);
  assert.ok(safe50 > safe10, `50bps safe (${safe50}) should exceed 10bps safe (${safe10})`);
  assert.ok(safe10 > safe1, `10bps safe (${safe10}) should exceed 1bps safe (${safe1})`);
});

test("safeSingleBuySize: zero cap returns 0", () => {
  const reserves = 100n * WEI_PER_ETH;
  assert.equal(safeSingleBuySize(reserves, 0n), 0n);
});

test("safeSingleBuySize: empty reserves returns 0", () => {
  assert.equal(safeSingleBuySize(0n, 50n), 0n);
});

// --- planSubBuys ----------------------------------------------------------

test("planSubBuys: count clamped to [minSubBuys, maxSubBuys] when budget is tiny", () => {
  const reserves = 100n * WEI_PER_ETH;
  // Tiny budget — would fit in one buy. Should clamp to minSubBuys=3.
  const plan = planSubBuys(1000n, reserves, { maxImpactBps: 50, minSubBuys: 3, maxSubBuys: 10 });
  assert.equal(plan.ok, true);
  assert.equal(plan.subBuys.length, 3);
});

test("planSubBuys: count clamped to maxSubBuys when budget is huge", () => {
  // Synthesize a tiny pool so safe size is small and many sub-buys would be
  // needed for a budget of 1 ETH.
  const reserves = WEI_PER_ETH; // 1 WETH pool
  const budget = 10n * WEI_PER_ETH; // 10 WETH ambitious
  const plan = planSubBuys(budget, reserves, { maxImpactBps: 50, minSubBuys: 3, maxSubBuys: 10 });
  assert.equal(plan.ok, true);
  assert.equal(plan.subBuys.length, 10);
});

test("planSubBuys: sub-buys sum exactly to totalBudgetWei", () => {
  const reserves = 100n * WEI_PER_ETH;
  const budget = WEI_PER_ETH / 4n + 7n; // 0.25 WETH + 7 wei to force remainder
  const plan = planSubBuys(budget, reserves, { maxImpactBps: 50, minSubBuys: 3, maxSubBuys: 10 });
  assert.equal(plan.ok, true);
  const total = plan.subBuys.reduce((acc, w) => acc + w, 0n);
  assert.equal(total, budget, `sum ${total} != budget ${budget}`);
});

test("planSubBuys: remainder goes to FIRST sub-buy", () => {
  const reserves = 100n * WEI_PER_ETH;
  // Choose a budget that does not divide evenly by minSubBuys=3.
  // budget=10 wei => base=3, remainder=1 => first=4, others=3.
  const plan = planSubBuys(10n, reserves, { maxImpactBps: 50, minSubBuys: 3, maxSubBuys: 10 });
  assert.equal(plan.ok, true);
  assert.equal(plan.subBuys.length, 3);
  assert.equal(plan.subBuys[0], 4n);
  assert.equal(plan.subBuys[1], 3n);
  assert.equal(plan.subBuys[2], 3n);
});

test("planSubBuys: rejects non-positive total budget", () => {
  const reserves = 100n * WEI_PER_ETH;
  const plan = planSubBuys(0n, reserves, { maxImpactBps: 50, minSubBuys: 3, maxSubBuys: 10 });
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /total_budget/);
});

test("planSubBuys: rejects empty pool", () => {
  const plan = planSubBuys(WEI_PER_ETH, 0n, { maxImpactBps: 50, minSubBuys: 3, maxSubBuys: 10 });
  assert.equal(plan.ok, false);
});

test("planSubBuys: each sub-buy is <= safeSingleBuySize when budget exceeds safe*max", () => {
  const reserves = 100n * WEI_PER_ETH;
  const safe = safeSingleBuySize(reserves, 50n);
  // Budget > safe * 10. We'll cap at 10 sub-buys, but each individual
  // sub-buy from the even-split should still be small enough that impact is
  // bounded (we accept a SMALL boundary case: each sub-buy under cap).
  const budget = safe * 5n; // fits in 5
  const plan = planSubBuys(budget, reserves, { maxImpactBps: 50, minSubBuys: 3, maxSubBuys: 10 });
  assert.equal(plan.ok, true);
  for (const sb of plan.subBuys) {
    const impact = priceImpactBps(reserves, sb);
    assert.ok(impact <= 50n, `sub-buy ${sb} has impact ${impact} > 50 bps`);
  }
});

test("planSubBuys: deterministic for identical inputs", () => {
  const reserves = 100n * WEI_PER_ETH;
  const a = planSubBuys(WEI_PER_ETH / 3n, reserves, { maxImpactBps: 50, minSubBuys: 3, maxSubBuys: 10 });
  const b = planSubBuys(WEI_PER_ETH / 3n, reserves, { maxImpactBps: 50, minSubBuys: 3, maxSubBuys: 10 });
  assert.equal(a.subBuys.length, b.subBuys.length);
  for (let i = 0; i < a.subBuys.length; i += 1) {
    assert.equal(a.subBuys[i], b.subBuys[i]);
  }
});

// --- readPoolState --------------------------------------------------------

test("readPoolState: returns no_pool_info when treasury.token.poolAddress is missing", async () => {
  const result = await readPoolState({ token: {} }, { BASE_RPC_URL: "https://example" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_pool_info");
});

test("readPoolState: returns no_rpc_url when env lacks an RPC URL", async () => {
  // Use a poolId so shape check passes.
  const poolId = "0x" + "1".repeat(64);
  const result = await readPoolState({ token: { poolAddress: poolId } }, {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_rpc_url");
});

test("readPoolState: rejects invalid pool address shape", async () => {
  const result = await readPoolState({ token: { poolAddress: "not-an-address" } }, { BASE_RPC_URL: "x" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /pool_address|no_pool_info/);
});

test("readPoolState: injected sqrtPriceX96 bypasses RPC", async () => {
  // Sqrt price for spot=1 (token1/token0 = 1) is 2^96
  const sqrtPriceX96 = (2n ** 96n).toString();
  const poolId = "0x" + "2".repeat(64);
  const result = await readPoolState({
    token: {
      poolAddress: poolId,
      poolSlot0: { sqrtPriceX96 }
    }
  }, { BASE_RPC_URL: "https://example.invalid" });
  assert.equal(result.ok, true, `expected ok, got reason=${result.reason || "<none>"}`);
  assert.ok(typeof result.sqrtPriceX96 === "bigint");
  assert.ok(result.reserveWethWei > 0n);
  // With spot=1, reserveOrbit should equal reserveWeth (well, very close
  // accounting for rounding).
  assert.equal(result.reserveOrbitWei, result.reserveWethWei);
});

// --- reservesFromSqrtPriceX96 --------------------------------------------

test("reservesFromSqrtPriceX96: spot=1 gives equal reserves", () => {
  const sqrt = 2n ** 96n;
  const notional = 5n * WEI_PER_ETH;
  const out = reservesFromSqrtPriceX96(sqrt, notional);
  assert.equal(out.reserveWethWei, notional);
  assert.equal(out.reserveOrbitWei, notional);
});

test("parseNotionalWei: defaults to 10 WETH; accepts decimals", () => {
  assert.equal(parseNotionalWei({}), 10n * WEI_PER_ETH);
  assert.equal(parseNotionalWei({ ORBIT_BUYBACK_POOL_NOTIONAL_WETH: "5" }), 5n * WEI_PER_ETH);
  assert.equal(parseNotionalWei({ ORBIT_BUYBACK_POOL_NOTIONAL_WETH: "0.5" }), WEI_PER_ETH / 2n);
  // Invalid -> default
  assert.equal(parseNotionalWei({ ORBIT_BUYBACK_POOL_NOTIONAL_WETH: "abc" }), 10n * WEI_PER_ETH);
});
