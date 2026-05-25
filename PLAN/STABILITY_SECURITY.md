# Stability & Security Rollout

Tracking doc for the stability/security work decided through 2026-05-25 design review. Source of truth for what's accepted, what's pending, and what's explicitly out of scope. Update as items land.

## 1. Cron skip-guard (accepted — landing now)

Replaces the unreliable `13,43 * * * *` cron + invisible scheduler drift with a base `*/15` cron and a signed, floor-protected skip-guard. Folds cadence reliability, over-fire defense, and state-tamper defense into one surface.

**Changes:**
- `.github/workflows/orbit-cycle.yml:5` cron → `"*/15 * * * *"`.
- New module `src/agent/skip-guard.js` with HMAC sign/verify + target draw.
- `src/agent/run.js` calls `evaluateSkip()` after state load, before cycle increment; persists `state.lastCycleAt`, `state.nextCycleTargetAt`, `state.skipGuardSig` after a real cycle finishes.

**Behavior:**
1. Manual (`workflow_dispatch`) and event (`issues`, `issue_comment`) triggers bypass the guard entirely. The guard only applies to `schedule` fires.
2. Hard floor: a scheduled fire less than 20 min after the prior cycle's finish is skipped unconditionally, regardless of any state value (defense against corrupted/forged state).
3. Signed target: each finished cycle draws a random next-target in [30, 90] min, HMAC-signed with the wallet private key. The next scheduled fire skips if `now < nextCycleTargetAt`. Forged/missing signatures cause the target to be ignored, not honored.
4. Skips log to stdout (runner logs), not to `cycles.jsonl` — keeps git history clean. Audit by inspecting gap patterns in real `cycles.jsonl` entries.

**Why this is the keystone:** GitHub Actions scheduler is unreliable on private repos (observed median 66 min vs. configured 30 min). Pure-cron jitter is fake jitter — depends on platform batching. This guard makes cadence state-driven, capped, and tamper-evident.

## 2. AI provider strategy (accepted — implement next phase)

Two separate concerns, kept separate:

**T-6 — Key rotation (security):** Advisory only.
- `state.aiKeyRotation = { lastRotatedAt, intervalDays: 90 }`.
- At > 90 days, open issue `orbit:rotation-due` (idempotent).
- **Never auto-block AI work.** Owner-driven swap via `npm run rotate:ai-key` runbook.

**T-8 — Performance-based routing (operational):** Replaces static priority order.
- `state.aiRouting.providers[name] = { successRate7d, avgLatencyMs, costPer1kUsd, qualityScore, rollingFailures, weight, demoteUntil }`.
- Each cycle: update objective signals (success, latency, cost) post-call.
- Selection: weighted shuffle with epsilon-greedy exploration.
- Auto-demote: 3 consecutive failures → weight 0 for 1h; 7d rolling success < 80% → permanent down-weight.
- Auto-promote: 24h clean stretch with > 95% success → weight restored.
- Start with success+latency+cost only; add quality proxies later.

See [[feedback-performance-based-ai-routing]] in memory for the policy rationale.

## 3. Treasury / scam gaps (ranked)

| ID | Gap | Status | Fix | Where |
|---|---|---|---|---|
| T-1 | No WETH-floor assertion in spend path | Pending | `assertTreasuryFloor(minWei)` called from every on-chain action; reject if post-spend balance < `state.treasuryFloorWei` | `governance.js` + callers (`clanker.js:142`, `buyback.js:72`, `merkle-anchor.js:288`, `federation.js:387`) |
| T-2 | `preLaunchVerified` is sticky once true | Pending | Bind to hash of 8 D-018 criteria; auto-flip on drift; open approval issue | `governance.js` |
| T-3 | Unsigned commits = full governance bypass | Pending | Branch protection on `main`: signed commits + status checks. Workflow imports GPG key from secrets | Repo settings + `orbit-cycle.yml` |
| T-4 | `fetchUrl`/`webSearch` injection risk | Pending — revised | **Untrusted-content envelope + URL risk scoring + provenance-tagged spend escalation.** No domain allowlist (would kill research). | `tools.js`, `safety.js`, `governance.js` |
| T-5 | Public approval issues leak amount + recipient | Pending | Encode spend as SHA256 id only; recipient/amount in private state file indexed by id | `governance.js:193-259` |
| T-6 | No AI key rotation mechanism | Pending | Advisory issue at 90 days, never auto-block (see §2) | `inference.js`, `state.json` |
| T-7 | No time-based expiry on `preLaunchVerified` | Pending | 30-day max age fallback (redundancy with T-2) | `governance.js` |
| T-8 | Static AI provider priority order | Pending | Performance-based routing (see §2) | `inference.js`, `state.json` |

See [[feedback-research-access-open]] in memory for the policy on T-4.

## 4. Observability (pending)

- `npm run audit:cadence` — reads `cycles.jsonl`, prints median/mean/p95 of real-fire gaps + histogram. Lets you see drift trends without scrolling logs.
- Gate-hash banner on dashboard — live hash of 8 D-018 criteria + the hash bound to `preLaunchVerified`. Visual smoke test for T-2.
- Approval-id index — private `sha256-id → {recipient, amount, intent}` mapping, pairs with T-5.
- Provider weight banner — current `state.aiRouting` weights, surfaces degraded routing.

## 5. Out of scope (do not do)

- More cron lines for fake randomness — subsumed by signed skip-guard.
- Backfilling missed cycles — queued-displacement is fine; `cycles.jsonl` is the truth.
- Calendar-forced provider rotation — performance signals only.
- Auto-blocking AI work on key age — advisory issue only.
- Quorum multi-sig (`governance.js:399-491`) — not worth friction at N=1 maintainer.
- Persistent bot runtime for token-gating — ship spec + `holders.json` to Pages; adopters run their own bots.
- Strict domain allowlist on `fetchUrl`/`webSearch` — kills research; content-layer defense instead.

## 6. Execution order

1. **Cron skip-guard** — this PR.
2. **T-1 WETH floor** — single highest treasury win.
3. **T-8 performance-based routing** — improves stability (auto-failover) and cost.
4. **T-2 gate-hash binding** — closes sticky-flag exploit.
5. **T-3 branch protection + signed commits** — closes biggest bypass surface.
6. **T-4 / T-5 / T-6 / T-7** + observability items — incremental once 1–5 land.
