# Clanker v4 Fee Strategy — Maximum Sustainable Capture

> **Critical doc.** Research-backed configuration for the $ORBIT launch. Premise: most reward token recipients dump immediately. We capture value through trading fees in WETH instead.

## Sources (all 2026)

- [Clanker v4 SDK docs](https://clanker.gitbook.io/clanker-documentation/sdk/v4.0.0)
- [Creator Rewards & Fees](https://clanker.gitbook.io/clanker-documentation/general/creator-rewards-and-fees)
- [Deploy Token v4.0.0](https://clanker.gitbook.io/clanker-documentation/authenticated/deploy-token-v4.0.0)
- [v4 core contracts](https://clanker.gitbook.io/clanker-documentation/references/core-contracts/v4)
- [Clanker.world deployments](https://clanker.gitbook.io/clanker-documentation/general/token-deployments/clanker.world-deployments)
- [Introducing v4 by @dish](https://paragraph.com/@dish/introducing-clanker-v4)

## The Core Numbers

| Question | Answer |
|---|---|
| Maximum % of LP fees we can keep | **80%** (Clanker protocol takes the other 20%, fixed) |
| Number of distinct reward recipients | **Up to 7** |
| Token denomination of fees | **Configurable per recipient: `Paired` (WETH), `Clanker` ($ORBIT), or `Both`** |
| Static fee range | **0%–any%** (set per direction: buy fee ≠ sell fee allowed) |
| Dynamic fee range | **base 0.25% min + variable cap 5% max** |
| v4.1 anti-sniper | **Starting fees up to 80%, parabolic decay over 30s** |

## The Critical Decision

> **Every recipient takes fees in `Paired` (WETH), not in `Clanker` ($ORBIT).**

Reason: Token reward recipients dump. If treasury accrues $ORBIT, the treasury bleeds with every dump. If treasury accrues WETH, the treasury grows independent of $ORBIT price action. WETH is the floor; $ORBIT appreciation is the ceiling. We need both, but the floor must be unconditional.

This is **D-002** in `DECISIONS.md` and is non-negotiable.

## Recipient Allocation (80% total creator share — the max protocol allows)

**Two-step model per D-019** (supersedes the "single Treasury Safe with internal sub-budgets" stance from D-017's implication block; the 95/5 inflow split itself is unchanged):

**Step 1 — Clanker contract pays out fees (95/5 inflow split):**

Per Clanker v4: `rewardBps` values represent percentages of the creator share (the 80%), not of total fees. Total recipient bps must sum to 10000 (= 100% of creator share).

| Slot | Recipient | bps (of creator share) | % of total fees | rewardsToken | Purpose |
|---|---|---|---|---|---|
| 1 | Fee Receive Safe (Base) | 9500 | 76% of fees | `Paired` (WETH) | Transit Safe. Drained weekly via the treasury sweep to the 6 bucket Safes below. Was called "Treasury Safe" in D-017. |
| 2 | Operator (founder) | 500 | 4% of fees | `Paired` (WETH) | Founder share, claimed weekly via existing `run_revenue_cycle`. Outside the treasury sweep math. |
| — | (Clanker protocol) | — | 20% of fees | (protocol) | Fixed, can't avoid |

**Step 2 — Weekly sweep redistributes the Fee Receive balance to 6 bucket Safes** (D-019 + `PLAN/SPECS/TREASURY_ALLOCATION.md`):

| Category | Safe | Bps of sweep | % of total fees | Purpose |
|---|---|---|---|---|
| Treasury | Floor Reserve | 4500 | 34.2% | Price-floor anchor; not deployable |
| Treasury | Productive Yield | 2000 | 15.2% | Aave/Uniswap deployment (S-027) |
| Business | Buyback | 500 | 3.8% | Weekly $ORBIT buybacks (D-005) |
| Business | Growth | 1500 | 11.4% | Mission rewards + adopter incentives + bounty matches |
| Operations | AI Costs | 1000 | 7.6% | AI invoice reimbursement for operator |
| Operations | Ops Runway | 500 | 3.8% | Gas + RPC + infra contingency |
| **Sum** | | **10000** | **76% of fees** | (= the Fee Receive inflow) |

**Total Orbit creator capture: 80% of fees, 100% in WETH.**

Notes:
- `admin` for **both** recipients is the **Treasury Safe**. Operator cannot unilaterally change the operator recipient address — re-routing requires a multisig vote. Pure additional rug-pull resistance.
- Operator address is your personal/founder address.
- Existing `treasury.json` already has `claimIntervalDays: 7` and performance gates — the weekly operator claim flows through the existing `run_revenue_cycle` tool with no code changes required.
- Buyback, bounty payouts, and lore spend all originate from the Treasury Safe under approval flow. They are operational decisions, not contract-level allocations.

## Fee Structure (Static, Symmetric)

Use `ClankerHookStaticFee`. **1% both directions** per owner directive.

| Direction | Fee |
|---|---|
| Buy $ORBIT (paired → orbit) | **1.00%** |
| Sell $ORBIT (orbit → paired) | **1.00%** |

Rationale for symmetric:
- Legible — same fee both ways, users understand instantly
- Doesn't feel predatory (asymmetric reads as "they tax sellers")
- Standard Uniswap-style fee that crypto users expect
- Easier to communicate in a cast: "1% trading fee, 76% goes to Orbit's treasury"

Volume × 1% × 76% = treasury take. At $200k daily volume that's ~$1.5k/day to treasury, ~$11k/week. Compounds fast at higher volumes.

If post-launch the market wants more aggressive capture (less likely now since we're symmetric/clean), we can migrate to dynamic fees in v2 with owner approval. Default stays at 1%/1%.

## v4.1 Anti-Sniper (If Available at Launch Time)

If Clanker v4.1 is live by launch:
- Enable **descending fee sniper tech**
- Starting fee: **80%** (catches snipers in the first 5 seconds)
- Parabolic decay to base over **30 seconds**

This is pure upside — bots pay massive fees, organic buyers get base fees within 30s. Decision: enable if available, default to static fees if not.

## Pool Configuration

Single pool at launch:
- Pair: **$ORBIT / WETH**
- Type: Uniswap V4 with `ClankerHookStaticFee` hook
- Initial LP: depends on Clanker's defaults at deploy time (we don't control this directly via SDK)

Up to 7 pools possible — defer to V2. One clean pool is easier to track, simpler narrative, easier liquidity story.

## Deployment Channel

> **Deploy via clanker.world frontend, NOT via @clanker Farcaster bot.**

Reason: Direct frontend deployments preserve more of the initial LP fees as creator rewards. Bot deploys have a small extra protocol cut. Frontend is also where the multi-recipient config UI is cleanest.

Process at launch time:
1. Connect deployer wallet (Treasury Safe owner key) at clanker.world
2. Fill recipient config matching table above
3. Set hook to `ClankerHookStaticFee` with asymmetric fees
4. Confirm deploy
5. Capture: token address, deploy tx hash, hook address, locker address — all in `memory/treasury.json`

## Buyback Discipline (Slot 2)

Slot 2 (Buyback Wallet, 15%) accumulates WETH. Once a week, Orbit:
1. Reads the WETH balance of the Buyback Wallet
2. Files an approval issue: "Buy back $ORBIT with X WETH from market"
3. Owner approves with comment
4. Agent executes via configured router
5. Receipt links the tx; bought $ORBIT goes to a vesting contract or burn address (TBD — see `DECISIONS.md` D-005)

This is a deflationary mechanism that's *provable* in the cycle proofs. Big trust signal for holders.

## Fee Claim Mechanics

Per Clanker v4, all fees route through `ClankerFeeLocker`. Recipients claim via:
- `claimRewards` SDK call (Clanker provides), OR
- Direct contract interaction

The existing `run_revenue_cycle` tool in `src/agent/tools.js` is already wired. After launch, it needs:
- Token address in `memory/treasury.json` set
- `ORBIT_ENABLE_REVENUE_CLAIMS=true` repo variable
- Performance gates satisfied (already true — see `treasury.js`)

Each claim is a public tx + cycle receipt. Show every claim on Farcaster.

## What This Captures At Various Volumes

Math: every swap pays 1%. Of that 1%, 80% goes to creator slots, 20% to Clanker. Of the 80%: 95% to Treasury, 5% to Operator (weekly).

| Daily volume | Daily total fees (1%) | Treasury take (76%) | Operator take (4%, weekly cadence) | Treasury monthly | Operator monthly |
|---|---|---|---|---|---|
| $50k | $500 | $380 | $20/day → $140/wk | ~$11k | ~$600 |
| $200k | $2,000 | $1,520 | $80/day → $560/wk | ~$46k | ~$2.4k |
| $1M | $10,000 | $7,600 | $400/day → $2,800/wk | ~$228k | ~$12k |
| $5M | $50,000 | $38,000 | $2,000/day → $14,000/wk | ~$1.14M | ~$60k |

Sustained $200k+ daily volume = self-sustaining operation. $1M+ = comfortable runway + buyback firepower. $5M+ = thriving project.

For comparison: gitlawb at $30M+ mcap likely sustained ~$500k–$2M daily volume in good weeks. That's our base-case target. Per `COMPS_RESEARCH.md`, weighted expected peak for Orbit is ~$8–12M mcap, which typically implies ~$50k–$300k daily volume in early weeks.

## What Goes Wrong If We Don't Do This

If recipients accrue in `Clanker` ($ORBIT) instead of `Paired` (WETH):
- Every dump from the broader holder base reduces the value of the treasury's $ORBIT
- Buyback loop becomes impossible (can't buy back what you already hold)
- Treasury "looks rich" in $ORBIT terms but is actually depreciating
- The only floor disappears

This is the single biggest mistake possible. Lock it in.

## Configuration Code Sketch

For reference when running the deploy (clanker.world UI mirrors these fields):

```typescript
// Pseudo-code for Clanker v4 SDK call
const deployment = await clanker.deploy({
  name: "Orbit",
  symbol: "ORBIT",
  // ... metadata: image, description, socials ...
  rewards: {
    recipients: [
      {
        recipient: ORBIT_TREASURY_SAFE,
        admin: ORBIT_TREASURY_SAFE,
        bps: 9500,        // 95% of creator share = 76% of total fees
        token: "Paired",  // WETH — survives dumps
      },
      {
        recipient: ORBIT_OPERATOR_REVENUE_ADDRESS,
        admin: ORBIT_TREASURY_SAFE,  // Safe controls — operator can't change their own
        bps: 500,         // 5% of creator share = 4% of total fees
        token: "Paired",  // WETH — weekly claim cadence
      },
    ],
  },
  fees: {
    type: "static",
    clankerFee: 100,  // 1.00% (100 bps) selling $ORBIT
    pairedFee: 100,   // 1.00% (100 bps) buying $ORBIT
  },
});
```

Verify exact field names against the SDK docs (`v4.0.0` SDK reference) at deploy time. Field names may have changed.

## Pre-Deploy Checklist

Before pulling the trigger on the Clanker deploy:

- [ ] Treasury Safe deployed on Base, all signers added, threshold set (2-of-3)
- [ ] Treasury Safe funded with ~0.1 ETH (gas reserve for ongoing claims)
- [ ] Operator Wallet address confirmed (your personal/founder address)
- [ ] Deployer wallet (the EOA connecting to clanker.world) funded with ~0.01 ETH for deploy tx
- [ ] Both addresses in GitHub Secrets matching env var names in `DEPLOY_PLAN.md`
- [ ] Fee config (1%/1%, 95/5 split, both WETH) confirmed on a screenshot of clanker.world before clicking deploy
- [ ] Cycle proof signing implemented and live (the launch receipt MUST be signed)
- [ ] Farcaster cast queued for the deploy moment
- [ ] Public dashboard live on GitHub Pages showing pre-launch state
- [ ] 14 consecutive days of stable cycles confirmed before launch day
