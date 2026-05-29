# PHASE 1 REVIEW — Launch-Ready (Pre-Token)

> Honest engineering review. Generated 2026-05-24 at session close.

## Summary

Phase 1 ships the full pre-launch product surface: signed cycle proofs, standalone verifier, public dashboard, Farcaster cast pipeline, npm-publishable SDK + scaffolder, lore foundation, treasury Safe runbook, and a working closed-loop demo. Pre-staged code for Phase 2 (buyback, Merkle anchor) and Phase 3 (federation parse stub, plugin loader, bounty/federation specs) is in place but D-018-locked. **S-GATE-1 CANNOT close today** — five owner actions remain (Pages, signer var, Farcaster signer, treasury Safe, npm publish), plus the 12-hour clean-cycle window which only the live Actions environment can produce.

## Phase 1 Session Status

| Session | Title | Status | Spec |
|---|---|---|---|
| S-001 | Plan compilation + Clanker fee research | SHIPPED | PLAN/MASTER_PLAN.md + 9 docs |
| S-002 | Wallet-signed cycle proofs (D-006) | SHIPPED | PLAN/SPECS/PROOF_SIGNING.md |
| S-003 | Public dashboard at orbit.horse (D-007) | SHIPPED | PLAN/SPECS/PUBLIC_DASHBOARD.md |
| S-004 | Farcaster cast pipeline (D-008) | SHIPPED | PLAN/SPECS/FARCASTER_CAST_PIPELINE.md |
| S-005 | Publish-ready @orbithouse/sdk + create-orbit-house (D-009) | SHIPPED | PLAN/SPECS/CREATE_ORBIT_HOUSE.md |
| S-006 | Closed-loop demo runbook + integration test | SHIPPED | PLAN/SPECS/CLOSED_LOOP_DEMO.md |
| S-007 | Lore foundation (00-genesis, voice, cycles-of-note) | SHIPPED | lore/README.md |
| S-008 | Treasury Safe deploy runbook | SHIPPED — owner runs deploy | PLAN/SPECS/TREASURY_SAFE_DEPLOY.md |
| S-009 | Closed-loop demo execution | OWNER-PENDING — runbook ready, needs live Actions cycle | PLAN/SPECS/CLOSED_LOOP_DEMO.md |
| S-010 | Phase 1 review + 14-day stabilization | SHIPPED (this doc) — 14-day clock owner-side | this file |
| S-014 | Buyback automation (Phase 2, pre-staged) | SPEC + CODE shipped, DRY_RUN-locked, D-018 gate enforced | PLAN/DECISIONS.md D-005 |
| S-015 | Daily Merkle anchor (Phase 2, pre-staged) | SPEC + CODE + contract shipped, DRY_RUN-locked | PLAN/SPECS/MERKLE_ANCHOR.md |
| S-017 | Refusal logging public surface (Phase 2, pre-staged) | SHIPPED — dashboard refusals tab live | inline in SDK |
| S-019/S-020 | Bounty market | SPEC-ONLY | PLAN/SPECS/BOUNTY_MARKET.md |
| S-021/22/23 | Federation protocol | SPEC + parse stub | PLAN/SPECS/FEDERATION.md |

## D-018 Token-Launch Gate — 8 Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `npm run health` 0 FAIL, 0 OPEN BLOCKERS | PARTIAL — 34 OK / 0 FAIL; STATUS.md has open owner blockers | health output 2026-05-24 |
| 2 | `npm test` 0 failures | MET — 365 pass / 0 fail | full suite run 2026-05-24 |
| 3 | AI provider configured + non-fallback proof | NOT-MET — owner sets ORBIT_AI_PROVIDERS / ORBIT_AI_PROVIDER_KEYS | health output: "ORBIT_AI_PROVIDERS not configured" |
| 4 | 12-hour clean cycle stretch via GitHub Actions | NOT-MET — requires live Actions cron runs; cannot self-verify | only owner can confirm via Actions log |
| 5 | Signed cycle proofs live + verifiable via `npx @orbithouse/verifier` | MET (code) — owner publishes verifier package to npm to activate `npx` flow | packages/orbit-verifier/ + S-002 |
| 6 | Public dashboard at orbit.horse reachable | PARTIAL — workflow shipped (deploy-dashboard.yml), CNAME present; owner enables Pages | dist/dashboard.json built; Pages not yet activated |
| 7 | Treasury Safe deployed and funded on Base | NOT-MET — owner action | runbook at PLAN/SPECS/TREASURY_SAFE_DEPLOY.md |
| 8 | Pre-deploy checklist fully checked | PARTIAL — CLANKER_FEE_STRATEGY.md exists; some items owner-side | PLAN/CLANKER_FEE_STRATEGY.md |

**D-018 verdict: 1 of 8 fully MET, 3 PARTIAL, 4 NOT-MET.** Token launch is correctly hard-blocked.

## Punch List — Open (Owner Action Required)

1. **Enable GitHub Pages** — Settings → Pages → Source: GitHub Actions; add `185.199.108–111.153` A-records for `orbit.horse`. Unblocks D-018 #6.
2. **Set `ORBIT_AGENT_SIGNER` repo variable** — derive from `ORBIT_WALLET_PRIVATE_KEY`. Unblocks signed-proof verification chain.
3. **Create Orbit Farcaster account + Neynar signer** — set `ORBIT_FARCASTER_NEYNAR_API_KEY` + `ORBIT_FARCASTER_SIGNER_UUID` secrets; flip `ORBIT_FARCASTER_DRY_RUN=false`. Unblocks daily-cast cadence.
4. **Deploy Treasury Safe on Base** — follow PLAN/SPECS/TREASURY_SAFE_DEPLOY.md (8-item checklist). Unblocks D-018 #7 + Clanker fee config.
5. **`npm publish --access public`** from `packages/orbit-sdk/` and `packages/create-orbit-house/` — register `@orbithouse` npm org first.
6. **Set AI provider keys** — `ORBIT_AI_PROVIDERS` + `ORBIT_AI_PROVIDER_KEYS` secrets. Unblocks D-018 #3.
7. **Let cycles run 12+ hours via Actions** — observe ≥24 consecutive clean cycles, record `firstCleanCycle` / `lastCleanCycle` in `memory/state.json`, flip `state.preLaunchVerified = true`. Unblocks D-018 #4.

## Engineering Health Snapshot

| Metric | Value |
|---|---|
| Test count | 365 pass / 0 fail / 0 skipped |
| Lint | clean (`node --check` across src/agent and src/cli) |
| Bundle (dashboard) | 215.6 KB raw / 66.5 KB gzipped (under 80 KB budget) |
| CSS | 29.5 KB / 7.1 KB gz |
| Dashboard JSON cap | ≤60 KB (enforced in `writeDashboardSnapshot`) |
| Projection cap | ≤30 KB (enforced in SDK `projectForDashboard`) |
| `npm run health` | 34 OK / 0 FAIL |
| New npm dependencies in Phase 1 | 0 |
| Packages in `packages/` | 5 (orbit-sdk, orbit-verifier, create-orbit-house, orbit-anchor, issue-scam-scanner) |
| Specs in `PLAN/SPECS/` | 9 (proof signing, dashboard, farcaster, create-orbit-house, closed-loop, treasury safe, merkle anchor, bounty, federation) |

## Risk Register Delta (vs S-001 RISKS.md)

| New / changed risk | Phase introduced | Mitigation shipped |
|---|---|---|
| Cast pipeline silently drifts from cycle truth | S-004 | Cast template `kind` recorded in cycle proof; ledger dedupes; outbound scanned |
| Plugin loader becomes attack surface for malicious tools | S-024 (pre-staged) | Capability gating (wallet/network require explicit env); name prefixing prevents collisions; default OFF |
| Multi-maintainer quorum disagreements lock the agent | Phase 4 (S-029, pre-staged) | One-rejection early termination prevents indefinite waits; threshold defaults preserve backward compat |
| Federation peer turns hostile | Phase 3 (S-021/22, pre-staged) | Quarantine pipeline rejects on shape/sig/risk/replay; evicted peers dropped pre-check |
| Buyback drains treasury via gas griefing | Phase 2 (S-014, pre-staged) | Weekly cap; slippage cap; approval-gated; D-018 hard-blocked until pre-launch verified |

## Recommendation for S-GATE-1

PHASES.md Phase 1 success criteria, verbatim:

| Criterion | Status | Evidence |
|---|---|---|
| 14 consecutive days of cycles with zero broken runs | NOT-MET | only owner can confirm via Actions cron |
| Signed proofs working in every cycle | MET (code) | S-002 + proof-signing.js |
| Public dashboard at orbit.horse stable | PARTIAL | workflow ready; Pages not enabled |
| ≥1 daily Farcaster cast for 14 days | NOT-MET | cast pipeline ready; signer not provisioned |
| ≥1 second adopter repo running Orbit | NOT-MET | outreach not begun (S-016) |
| Closed-loop demo run successfully once | NOT-MET | runbook + test ready; needs live Actions run |
| Treasury Safe deployed and funded | NOT-MET | owner action |
| Lore foundation written | MET | lore/00-genesis.md + voice.md shipped |

**S-GATE-1 cannot close today.** Five criteria require live Actions runs or owner actions before sign-off. Engineering is complete and gated; the gate is correctly open.

## Phase 2 Readiness

Pre-staged code is shipped behind D-018 hard-blocks:
- **Buyback** (`src/agent/buyback.js`): refuses unless `ORBIT_ENABLE_BUYBACK=true` AND `state.preLaunchVerified===true` AND `state.tokenAddress` set AND router address set. Live execution path blocked with `status: "blocked_live_unavailable"` until a wallet helper is exported.
- **Merkle anchor** (`src/agent/merkle-anchor.js` + `packages/orbit-anchor/`): same gate pattern. Contract source ships in `packages/orbit-anchor/contracts/MerkleAnchor.sol` for owner-side deploy.
- **Refusal log surface** (SDK + Dashboard): refusals tab live, sanitized through `sanitizePublicArtifact`, capped at 20 entries, fits inside 30 KB projection.

When S-GATE-1 closes and Phase 2 opens, the engineering work for Phase 2 reduces to:
1. Owner sets `ORBIT_ENABLE_BUYBACK=true` and `ORBIT_ENABLE_MERKLE_ANCHOR=true` after Clanker deploy.
2. Wallet helper `wallet.sendBuybackTransaction` and `wallet.sendAnchorTransaction` get exported by owner-reviewed code in `src/agent/wallet.js`.
3. Token address, anchor contract address, router address get set as secrets.
4. First weekly buyback proposed by Orbit, approved by owner, executed.
5. First daily Merkle root anchored on Base.

## Bottom Line

Phase 1 engineering work is **DONE**. The product is launchable from the code's perspective. The remaining work is the seven owner actions in §"Punch List — Open". Each has a runbook. None require additional engineering.

S-GATE-1 stays open until owner closes the punch list. SGATE_1.md tracks the closing checklist.
