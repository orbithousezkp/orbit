# HOLDER_UTILITY.md — Token Holder Utility (S-034)

## 1. Goal

$ORBIT holders get measurable, transparent utility beyond speculation: priority queue boost in cycle prioritization, configurable rate limits on certain tools (within owner caps), early access to new SDK methods. Every holder benefit is logged in cycle proofs so the asymmetry is publicly auditable.

## 2. Constraints

- github-only
- No on-chain action without approval per **D-014**
- Token-launch hard-block per **D-018** — utility inactive until S-GATE-2 closes
- Holder benefits do NOT bypass approval gates, safety checks, or any refusal logic
- Boost is small and bounded — non-holders cannot be drowned out
- All gating uses snapshot-based balance check (same as SUBSCRIPTION_TIER.md)

## 3. Scope

In:
- Priority queue boost (sort-tie-breaker only; never jumps a refusal or pending approval)
- Holder-configurable rate limits within owner-set caps (e.g., max 5 issue comments per cycle becomes 10 for holders, but never exceeds the owner cap of 20)
- Early-access surface (new SDK methods unlock for holders 14 days before general release)
- Holder leaderboard in dashboard (top-10, anonymized addresses)

Out:
- Skipping refusals / overriding safety (never)
- Skipping owner approval (never)
- Direct payments to holders (no airdrops, no buyback distribution)
- KYC or identity linking

## 4. Design

### Holder claim shape
Same signed-claim format as SUBSCRIPTION_TIER.md, with extension:
```json
{
  "schema": "orbit-holder/1",
  "address": "0xHOLDER...",
  "snapshotBlock": 12345678,
  "balanceWei": "5000000000000000000000",
  "tier": "tier-1",
  "benefits": ["priority-boost", "rate-limit-2x", "early-access"],
  "signature": "0x...",
  "signer": "0x..."
}
```

### Tier thresholds (initial; tunable by owner approval)
| Tier | Min balance | Benefits |
|---|---|---|
| free | 0 | base SDK |
| tier-1 | 100 $ORBIT | priority-boost (small) |
| tier-2 | 1,000 $ORBIT | + rate-limit-2x |
| tier-3 | 10,000 $ORBIT | + early-access (14d window) |

### Priority queue boost
```js
function computePriorityScore(item, holderTier) {
  let base = item.baseScore;       // existing prioritization
  if (holderTier === "tier-1") base += 1;
  if (holderTier === "tier-2") base += 2;
  if (holderTier === "tier-3") base += 3;
  return Math.min(base, MAX_PRIORITY); // hard cap
}
```
Cap ensures even tier-3 holders can't dominate the queue — they win ties, not strict ordering.

### Rate-limit interpretation
- Owner sets absolute cap (`ORBIT_RATE_LIMIT_MAX`) for every tool
- Holder gets `min(holderRequestedLimit, ownerCap)` — never above
- Cycle proof logs the applied limit and the holder tier that justified it

## 5. D-014 + D-018 Alignment

| Decision | Application |
|---|---|
| D-014 | Holder benefits never bypass approval gates. Tier-3 holders still need owner approval for on-chain actions. |
| D-018 | Holder utility inactive until S-GATE-2. Pre-launch, all repos and users get the base tier (=free) regardless of off-chain balance claims. |

## 6. Failure Modes

1. Holder claim stale → revert to base tier; surface "claim refresh needed" in dashboard.
2. Holder balance drops below tier threshold mid-week → next snapshot downgrades; no retroactive clawback.
3. Owner cap conflict (holder asks for 50 calls/cycle, cap is 10) → cap wins; cycle proof logs both.
4. Priority boost manipulation (sybil holders) → boost is small enough that splitting balance reduces the boost (concavity ensures one big holder always > many small).
5. Holder tries to use early-access to leak features to non-holders → SDK methods log holder tier on every call; abuse becomes visible.

## 7. Test Plan (future)

- Tier derivation from balance + thresholds (boundary cases at each threshold)
- Priority score capped at MAX_PRIORITY
- Rate limit always ≤ owner cap
- Early-access method blocks tier-1 and tier-2; allows tier-3
- Holder claim verification (signer match)
- Stale claim → base tier
- Cycle proof records tier used in every relevant decision

## 8. Open Questions

- Should benefits scale linearly with balance, or step-function? Step is simpler and harder to game.
- Should benefits be reduced if the holder is also the operator? Yes — operator cannot use holder utility on top of operator-share fees (anti-double-dip).
- How to anonymize holder leaderboard? Truncate address; sort by tier only, not exact balance.

## 9. Cross-References

- `PLAN/SPECS/SUBSCRIPTION_TIER.md` (repo-level analog; this spec is for individual holders)
- `PLAN/SPECS/PLUGIN_MARKETPLACE.md` (verified-author badge for tier-3 plugin authors)
- `PLAN/DECISIONS.md` — D-014, D-018
