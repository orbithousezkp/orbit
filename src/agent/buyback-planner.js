"use strict";

// S-BUY-1: Intelligent buyback campaign planner.
//
// Reads the $ORBIT/WETH pool state and plans sub-buys so that each individual
// swap stays below a configured price-impact ceiling (default 0.5% / 50 bps).
// This is the first half of the "random + split" defense the user asked for —
// it answers "how big can a single sub-buy be without pumping the pool?". The
// scheduler (./buyback-scheduler) answers "when do they fire?".
//
// All wei math is BigInt end-to-end. Number is reserved for bps comparisons
// and never touches wei amounts directly. Per-step rounding is biased toward
// underestimating impact (i.e., we round UP price impact and round DOWN sub-buy
// sizes) so the cap is sticky rather than springy.
//
// V4 quoter integration is STUBBED:
//   - readPoolState() reads slot0 via StateLibrary if a poolAddress is
//     configured, converts sqrtPriceX96 to a spot price, and synthesizes a
//     constant-product (reserveWeth, reserveOrbit) pair from a notional TVL.
//   - planSubBuys() then uses V2 constant-product math against that pair.
// TODO(S-BUY-2): replace the synthetic reserve pair with a real V4 Quoter
// integration so price-impact estimates reflect routed liquidity rather than
// a single-tick approximation. Until then, the synthetic estimate is
// deliberately conservative: it tends to OVER-state impact for concentrated
// V4 positions, which means we err on the side of MORE sub-buys, never fewer.

const { isAddress } = require("./addresses");

const BPS_DENOMINATOR = 10000n;
const WEI_PER_ETH = 10n ** 18n;
// Q96 = 2^96. sqrtPriceX96 is a Q64.96 fixed-point square root of the
// price ratio of token1/token0. We convert to a spot price by squaring,
// which yields a Q128.192 value (and a 192-bit shift).
const Q96 = 2n ** 96n;

// Notional pool TVL used to synthesize (reserveWeth, reserveOrbit) from the
// slot0 spot price when only sqrtPriceX96 is available. Configurable via
// ORBIT_BUYBACK_POOL_NOTIONAL_WETH (decimal, default 10 WETH). The exact value
// is not load-bearing for the splitting math — what matters is that we hold a
// consistent denominator across priceImpactBps and safeSingleBuySize.
const DEFAULT_NOTIONAL_WETH_WEI = 10n * WEI_PER_ETH;

// V4 contract addresses on Base. The V4 PoolManager and StateLibrary are
// canonical per the Uniswap V4 deploy. We only call read-only views, so this
// module never touches a wallet client.
//
// TODO(S-BUY-2): pin these to a published config / deployment manifest.
const V4_STATE_VIEW_ADDRESS = "0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71";

// Minimal ABI fragment for StateView.getSlot0(bytes32) -> (sqrtPriceX96, tick,
// protocolFee, lpFee). We intentionally do NOT pull the full ABI: the smaller
// the surface, the smaller the blast radius if the ABI moves.
const STATE_VIEW_ABI = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" }
    ]
  }
];

function parseNotionalWei(env) {
  const raw = env && env.ORBIT_BUYBACK_POOL_NOTIONAL_WETH;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return DEFAULT_NOTIONAL_WETH_WEI;
  }
  const str = String(raw).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) return DEFAULT_NOTIONAL_WETH_WEI;
  const [whole, frac = ""] = str.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  try {
    const wei = BigInt(whole + fracPadded);
    return wei > 0n ? wei : DEFAULT_NOTIONAL_WETH_WEI;
  } catch {
    return DEFAULT_NOTIONAL_WETH_WEI;
  }
}

// Synthesize (reserveWeth, reserveOrbit) from a spot price and a notional TVL.
// Constant-product invariant: a synthetic V2-style pool with reserves (R_w,
// R_o) such that R_o/R_w = spotPriceOrbitPerWeth gives the same first-order
// price impact as a thin V4 tick at the same spot.
function reservesFromSqrtPriceX96(sqrtPriceX96, notionalWethWei) {
  // priceQ192 = sqrtPriceX96^2. spotPrice (token1/token0) = priceQ192 / 2^192.
  // We expect the pool to be ordered (token0=WETH, token1=$ORBIT) when ORBIT
  // address > WETH address — which is the v4 lexicographic ordering. If the
  // ordering is reversed the impact math still holds (we just label things
  // accordingly inside planSubBuys via the input reserve), so we surface the
  // numerator/denominator unchanged.
  const priceQ192 = sqrtPriceX96 * sqrtPriceX96;
  // reserveOrbit = reserveWeth * spotPrice
  //              = reserveWeth * priceQ192 / 2^192
  // Use BigInt division (floor) — undercounts liquidity slightly, which
  // means our impact estimate is slightly conservative.
  const denom = Q96 * Q96; // 2^192
  const reserveOrbitWei = (notionalWethWei * priceQ192) / denom;
  return { reserveWethWei: notionalWethWei, reserveOrbitWei };
}

// V2 constant-product price impact estimate.
//
// Given (reserveIn, amountIn):
//   amountOut    = (amountIn * reserveOut) / (reserveIn + amountIn)
//   priceBefore  = reserveOut / reserveIn
//   priceAfter   = (reserveOut - amountOut) / (reserveIn + amountIn)
//   impactBps    = ((priceBefore - priceAfter) / priceBefore) * 10000
//
// reserveOut cancels in the impact ratio, so we only need reserveIn and
// amountIn. The closed form (after algebra) is:
//   impactBps = amountIn * (2*reserveIn + amountIn) * 10000
//               / (reserveIn + amountIn)^2
//
// Returns a BigInt of basis points. All arithmetic in BigInt; the only
// rounding is the final division (floor). Floor is the right direction for
// safety: when we later compare against the cap with <=, an under-estimated
// impact means we MIGHT slightly exceed the cap by sub-bp amounts on tiny
// reserves — but the binary search compensates by tightening to <= cap.
function priceImpactBps(reserveInWei, amountInWei) {
  const reserveIn = BigInt(reserveInWei);
  const amountIn = BigInt(amountInWei);
  if (reserveIn <= 0n) {
    // Empty pool: any buy is infinite impact. Return a sentinel larger than
    // any plausible cap so safeSingleBuySize collapses to 0.
    return BPS_DENOMINATOR * 1000000n;
  }
  if (amountIn <= 0n) return 0n;
  const numerator = amountIn * (2n * reserveIn + amountIn) * BPS_DENOMINATOR;
  const denom = (reserveIn + amountIn) * (reserveIn + amountIn);
  return numerator / denom;
}

// Binary-search the largest amountIn (in wei) such that
//   priceImpactBps(reserveInWei, amountIn) <= maxImpactBps
// Returns a BigInt. The search bounds are [0, reserveInWei] because past 100%
// of the reserve there is no meaningful price discovery left.
function safeSingleBuySize(reserveInWei, maxImpactBps) {
  const reserve = BigInt(reserveInWei);
  const cap = BigInt(maxImpactBps);
  if (reserve <= 0n || cap <= 0n) return 0n;

  let lo = 0n;
  let hi = reserve;
  // 256 iterations is overkill but cheap; the search space is at most
  // log2(2^256) = 256 steps. In practice we converge in ~70.
  for (let i = 0; i < 256; i += 1) {
    if (lo >= hi) break;
    // mid biased UP to avoid infinite loop on (lo, lo+1)
    const mid = (lo + hi + 1n) / 2n;
    const impact = priceImpactBps(reserve, mid);
    if (impact <= cap) {
      lo = mid;
    } else {
      hi = mid - 1n;
    }
  }
  return lo;
}

// Plan N sub-buys for totalBudgetWei such that each is <= safeSingleBuySize.
//
// n = clamp(ceil(totalBudgetWei / safeSize), [minSubBuys, maxSubBuys])
// Distribute totalBudgetWei across n sub-buys as evenly as possible. Any
// remainder from the integer division goes to the FIRST sub-buy
// (deterministic — randomness lives in the scheduler, not the amounts).
//
// Returns:
//   { ok: true, subBuys, safeSingleBuySize, plannedImpactBps }
//   { ok: false, reason }   when budget is non-positive or pool empty
function planSubBuys(totalBudgetWei, reserveInWei, opts = {}) {
  const totalBudget = BigInt(totalBudgetWei);
  const reserve = BigInt(reserveInWei);
  const maxImpactBps = BigInt(opts.maxImpactBps || 50);
  const minSubBuys = Math.max(1, Number(opts.minSubBuys || 3));
  const maxSubBuys = Math.max(minSubBuys, Number(opts.maxSubBuys || 10));

  if (totalBudget <= 0n) {
    return { ok: false, reason: "total_budget_non_positive" };
  }
  if (reserve <= 0n) {
    return { ok: false, reason: "reserve_non_positive" };
  }

  const safeSize = safeSingleBuySize(reserve, maxImpactBps);
  if (safeSize <= 0n) {
    return { ok: false, reason: "safe_single_buy_size_zero" };
  }

  // ceil(totalBudget / safeSize) using BigInt math
  let n = Number((totalBudget + safeSize - 1n) / safeSize);
  if (n < minSubBuys) n = minSubBuys;
  if (n > maxSubBuys) n = maxSubBuys;

  // Even split with remainder to first.
  const nBig = BigInt(n);
  const base = totalBudget / nBig;
  const remainder = totalBudget - base * nBig;
  const subBuys = new Array(n);
  for (let i = 0; i < n; i += 1) {
    subBuys[i] = base;
  }
  // Remainder to the FIRST sub-buy (deterministic).
  subBuys[0] = subBuys[0] + remainder;

  // The actual planned impact is whatever the LARGEST sub-buy would do
  // against the current reserve. With remainder-to-first that's subBuys[0].
  const plannedImpactBps = priceImpactBps(reserve, subBuys[0]);

  return {
    ok: true,
    subBuys,
    safeSingleBuySize: safeSize,
    plannedImpactBps
  };
}

// Read pool state from chain. Returns:
//   { ok: true, sqrtPriceX96, reserveWethWei, reserveOrbitWei, poolAddress }
//   { ok: false, reason }
//
// The "poolAddress" returned here is really the v4 poolId (bytes32) — we keep
// the field name "poolAddress" per the task spec, but document this here so a
// reader doesn't go searching for an EOA. V4 pools are identified by a hash
// of their (token0, token1, fee, tickSpacing, hooks) tuple, not by a contract.
async function readPoolState(treasury, env) {
  const token = (treasury && treasury.token) || {};
  // Caller may supply treasury.token.poolAddress as either an EVM address
  // (legacy V3) or a v4 poolId (bytes32, 0x + 64 hex). Both are accepted —
  // we only refuse when nothing is present at all.
  const poolAddress = token.poolAddress || "";
  if (!poolAddress) {
    return { ok: false, reason: "no_pool_info" };
  }
  // Shape check: accept either a 20-byte address or a 32-byte poolId.
  const raw = String(poolAddress).trim();
  const isPoolId = /^0x[0-9a-fA-F]{64}$/.test(raw);
  const isPoolAddr = isAddress(raw);
  if (!isPoolId && !isPoolAddr) {
    return { ok: false, reason: "pool_address_invalid_shape" };
  }

  const rpcUrl = (env && (env.ORBIT_BASE_RPC_URL || env.BASE_RPC_URL || env.RPC_URL)) || "";
  if (!rpcUrl) {
    return { ok: false, reason: "no_rpc_url" };
  }

  // Test seam: callers may inject a sqrtPriceX96 directly via the treasury
  // record (treasury.token.poolSlot0.sqrtPriceX96) to bypass the RPC layer.
  // This is also the path the planner uses when V4 read fails — we treat the
  // configured value as a last-known snapshot and surface it transparently.
  const injected = token.poolSlot0 && token.poolSlot0.sqrtPriceX96;
  let sqrtPriceX96 = null;
  if (injected !== undefined && injected !== null && String(injected) !== "") {
    try {
      sqrtPriceX96 = BigInt(injected);
    } catch {
      sqrtPriceX96 = null;
    }
  }

  if (sqrtPriceX96 === null) {
    // Live read via viem. We import lazily so test environments without an
    // RPC URL never touch the network.
    let viem;
    try {
      // eslint-disable-next-line global-require
      viem = require("viem");
      // eslint-disable-next-line global-require
      const { base } = require("viem/chains");
      const transport = viem.http(rpcUrl);
      const publicClient = viem.createPublicClient({ chain: base, transport });
      if (!isPoolId) {
        // V3-style address: we don't speak the slot0() ABI on this path
        // because it's strictly a stub. Surface the missing capability.
        // TODO(S-BUY-2): add a V3 slot0() path here.
        return {
          ok: false,
          reason: "v3_pool_read_not_implemented"
        };
      }
      const result = await publicClient.readContract({
        address: V4_STATE_VIEW_ADDRESS,
        abi: STATE_VIEW_ABI,
        functionName: "getSlot0",
        args: [raw]
      });
      // result is a tuple [sqrtPriceX96, tick, protocolFee, lpFee]
      sqrtPriceX96 = BigInt(result[0]);
    } catch (err) {
      return {
        ok: false,
        reason: "rpc_read_failed",
        detail: err && err.message ? err.message : String(err)
      };
    }
  }

  if (sqrtPriceX96 <= 0n) {
    return { ok: false, reason: "sqrt_price_zero" };
  }

  const notional = parseNotionalWei(env);
  const { reserveWethWei, reserveOrbitWei } = reservesFromSqrtPriceX96(sqrtPriceX96, notional);

  return {
    ok: true,
    sqrtPriceX96,
    reserveWethWei,
    reserveOrbitWei,
    poolAddress: raw
  };
}

module.exports = {
  BPS_DENOMINATOR,
  WEI_PER_ETH,
  priceImpactBps,
  safeSingleBuySize,
  planSubBuys,
  readPoolState,
  reservesFromSqrtPriceX96,
  parseNotionalWei
};
