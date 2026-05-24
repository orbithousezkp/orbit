# SUBSCRIPTION_TIER.md — Per-Repo Subscription Tier (S-025)

## 1. Goal

Token-gated SDK access. Repos whose owner holds ≥X $ORBIT (snapshot-based) unlock premium SDK surfaces: deeper insights queries, federation read access, cross-repo dashboards. The free SDK shipped in Phase 1 stays fully free forever; premium adds new surfaces only.

## 2. Constraints

- github-only infrastructure
- No on-chain action without approval issue per **D-014**
- Token-launch hard-block per **D-018** — subscription tier inactive until Phase 2 closes (S-GATE-2)
- No PII collection — gating is by token balance, not by identity
- Free SDK must remain free and useful indefinitely (downgrade-safe)

## 3. Scope

In:
- Snapshot-based balance check (weekly cadence)
- Signed claim ("this repo's owner holds ≥X $ORBIT as of block Y") produced by Orbit's signer
- Premium method allowlist (new SDK methods only)
- Downgrade behavior (premium methods return `{ ok:false, reason:"tier_required" }` for non-subscribers)

Out:
- Live-balance gating (latency unacceptable; snapshot is enough)
- Identity-linked gating (no KYC)
- Server-side enforcement of premium calls (SDK is client-side; gate is honor-system + signed claim used for downstream verification)

## 4. Design

### Env vars
| Var | Purpose |
|---|---|
| `ORBIT_SUBSCRIPTION_TIER_THRESHOLD` | Minimum $ORBIT balance (decimal string, e.g., "10000") |
| `ORBIT_SUBSCRIPTION_SNAPSHOT_BLOCK` | Block number used in last snapshot |
| `ORBIT_SUBSCRIPTION_VERIFIED` | Boolean — set true after weekly snapshot proof landed |

### Tier claim shape
```json
{
  "schema": "orbit-subscription/1",
  "repo": "owner/repo",
  "snapshotBlock": 12345678,
  "snapshotAt": "2026-09-01T00:00:00Z",
  "balanceWei": "10000000000000000000000",
  "thresholdWei": "10000000000000000000000",
  "tier": "premium",
  "signature": "0x...",
  "signer": "0x..."
}
```

### SDK interface additions
```js
function currentTier(repoRoot) {}                      // -> "free" | "premium" — reads claim from memory/subscription.json
function verifyTierClaim(claim, expectedSigner) {}     // -> {ok, recoveredSigner?, error?}
function premiumOnly(method) {}                        // decorator — returns wrapped method that checks tier first
```

### Premium method surface (initial)
- `getCrossRepoDigest(peerRepos)` — federation-backed (depends on FEDERATION.md)
- `getDeepReceiptAnalysis(cycleRange)` — beyond the standard slim projection
- `getRefusalPatterns(windowDays)` — refusal heuristics by category

## 5. D-014 + D-018 Alignment

| Decision | Application |
|---|---|
| D-014 | Snapshot publication is approval-gated. Orbit proposes a snapshot, owner approves the claim signing. |
| D-018 | Subscription gate inactive until S-GATE-2. Until then, all SDK methods are free regardless of token holdings. |

## 6. Failure Modes

1. Snapshot stale (>14 days) → tier reverts to "free" until refresh.
2. Signer rotation mid-snapshot → claim signature invalidated; SDK shows "tier_unverified" warning.
3. Owner accidentally deletes claim file → next cycle regenerates from current balance.
4. Token price collapse pushes holders under threshold → tier downgrades on next snapshot; no clawback of past premium calls.
5. Malicious actor publishes a fake claim → SDK rejects on signer mismatch; only the published `ORBIT_AGENT_SIGNER` is trusted.

## 7. Test Plan (future)

- `verifyTierClaim` rejects bad signature
- `verifyTierClaim` rejects signer mismatch
- `verifyTierClaim` accepts well-formed valid claim
- `currentTier` returns "free" when claim missing
- `currentTier` returns "free" when claim stale
- `premiumOnly` wrapper blocks calls when tier is free
- Edge: balance equals threshold exactly → premium (≥ not >)

## 8. Open Questions

- Snapshot mechanism: read live from Base RPC at a fixed block? Use Merkle root of `Transfer` events? Defer to S-025 implementation.
- Threshold setting authority: owner sets, or DAO-style governance? Phase 4 question.
- Edge cases for repo-ownership transfer (repo sold mid-week): refresh on next snapshot cycle.

## 9. Cross-References

- `PLAN/SPECS/FEDERATION.md` — premium cross-repo methods depend on federation
- `PLAN/SPECS/HOLDER_UTILITY.md` — partial overlap; holder-utility is for individual holders, subscription-tier is for repos
- `PLAN/DECISIONS.md` — D-014, D-018
