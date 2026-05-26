# Orbit — Phased Build Plan

Five phases. Each is gated by concrete deliverables, not dates. Move to the next phase only when the current one's success criteria are met.

> Session IDs follow ClaudeCodex convention (S-XXX). S-PLAN = no code. S-BUILD = code. S-REVIEW = polish + bug list. S-GATE = phase transition.

---

## PHASE 1 — Launch-Ready (Pre-Token)

**Goal:** Convert today's state into a launchable product with signed receipts, public dashboard, daily casts, and a closed self-funding loop demonstrated once.

**Duration:** Day 1–14 (~2 weeks of focused work)

**Success criteria for phase exit (S-GATE-1):**
- 14 consecutive days of cycles with zero broken runs
- Signed proofs working in every cycle
- Public dashboard at orbit.horse stable
- ≥1 daily Farcaster cast for 14 days
- ≥1 second adopter repo running Orbit
- Closed-loop demo run successfully once
- Treasury Safe deployed and funded
- Lore foundation written

### Sessions

| ID | Type | Focus | Output |
|----|------|-------|--------|
| S-001 | S-PLAN | Lock launch architecture, sign protocols, recipient addresses | This PLAN/ directory finalized |
| S-002 | S-BUILD | Wallet-signed cycle proofs | `src/agent/proofs.js` extension; every receipt signed |
| S-003 | S-BUILD | Verifier CLI as separate package | `packages/orbit-verifier/` published |
| S-004 | S-BUILD | Farcaster caster integration | `src/agent/farcaster.js` + tool entry |
| S-005 | S-BUILD | Public dashboard at orbit.horse | `apps/dashboard/` deployed |
| S-006 | S-BUILD | Lore foundation + voice guide | `lore/` directory populated |
| S-007 | S-BUILD | SDK npm publish + `create-orbit-repo` scaffolder | Both packages live on npm |
| S-008 | S-PLAN | Treasury Safe + recipient wallet setup | Addresses recorded in DEPLOY_PLAN.md |
| S-009 | S-BUILD | Closed-loop self-funding demo | Public receipt of one full cycle |
| S-010 | S-REVIEW | Phase 1 review + 14-day stabilization | Punch list cleared |
| S-GATE-1 | S-GATE | Phase 1 sign-off — launch readiness | All success criteria met |

---

## PHASE 2 — Token Launch + First 30 Days

**Goal:** Deploy $ORBIT via Clanker v4 with optimized fee config. Sustain visible cycles. Treasury starts capturing WETH.

**Duration:** Day 15–45

**Success criteria for phase exit (S-GATE-2):**
- $ORBIT deployed on Base
- ≥30 days of unbroken cycles post-launch
- Treasury Safe holds ≥1 ETH equivalent in fees
- First $ORBIT buyback executed publicly
- Cycle proofs anchored daily (Merkle root committed to Base)
- ≥5 adopter repos running Orbit
- No security incident, no key leak, no embarrassing public refusal

### Sessions

| ID | Type | Focus | Output |
|----|------|-------|--------|
| S-011 | S-PLAN | Clanker v4 deploy dry run, asymmetric fee config validation | Test-deploy proof |
| S-012 | S-BUILD | Token deploy execution | $ORBIT live on Base |
| S-013 | S-BUILD | Genesis cycle + first 24h support | Public receipts |
| S-014 | S-BUILD | Weekly buyback automation | `src/agent/buyback.js` + approval flow |
| S-015 | S-BUILD | Daily Merkle anchor on Base | One tx per day, root committed |
| S-016 | S-BUILD | Adopter onboarding push (5 repos target) | Direct outreach + scaffolder polish |
| S-017 | S-BUILD | Refusal logging public surface | Refused intake posted with redaction |
| S-018 | S-REVIEW | Phase 2 review | 30-day report card |
| S-GATE-2 | S-GATE | Phase 2 sign-off — token sustained | All criteria met |

---

## PHASE 3 — Token Utility + Federation

**Goal:** $ORBIT becomes useful for something besides speculation. Multiple orbit-powered repos talk to each other. Bounty market live.

**Duration:** Month 2–6

**Success criteria for phase exit (S-GATE-3):**
- Bounty market live with ≥10 bounties posted
- ≥20 adopter repos
- Inter-Orbit federation protocol live with ≥3 cross-repo intel shares
- Per-repo subscription tier launched
- Plugin economy with ≥3 third-party `@orbit/tool-*` plugins
- Treasury self-sustaining (weekly inflow > weekly outflow)

### Sessions

| ID | Type | Focus | Output |
|----|------|-------|--------|
| S-019 | S-PLAN | Bounty market spec | `docs/bounty-market.md` |
| S-020 | S-BUILD | Bounty market MVP | Escrow contract + agent verifier + approval flow |
| S-021 | S-PLAN | Inter-Orbit federation protocol | `docs/federation.md` |
| S-022 | S-BUILD | Federation MVP — HELLO + INTEL_SHARE messages | Signed envelopes + quarantine |
| S-023 | S-BUILD | Federation MVP — CAPABILITY_ADVERTISE + registry | On-chain or static registry |
| S-024 | S-BUILD | Plugin/tool loader for `@orbit/tool-*` | Plugin discovery from package.json deps |
| S-025 | S-BUILD | Per-repo subscription tier | Token-gated SDK access |
| S-026 | S-BUILD | Bounty referral across orbits | BOUNTY_REFERRAL message type |
| S-027 | S-BUILD | Treasury productive deployment | LP/lending integration |
| S-028 | S-REVIEW | Phase 3 review | Adoption + revenue scorecard |
| S-GATE-3 | S-GATE | Phase 3 sign-off | All criteria met |

---

## PHASE 4 — Network Effect + Standard

**Goal:** Other agents (Sweep, OpenHands, anyone) start reading Orbit passports. Spec gets adopted. Treasury earns from protocol fees beyond the Clanker pool.

**Duration:** Month 6–12

**Success criteria for phase exit (S-GATE-4):**
- ≥50 adopter repos
- ≥1 external agent framework reads Orbit passport
- Protocol fee revenue ≥30% of trading fee revenue
- Treasury productivity (LP/lending) generating ≥20% APY on idle capital
- Multi-maintainer quorum live on ≥10 adopter repos
- Founder visibility decreasing measurably

### Sessions

| ID | Type | Focus | Output |
|----|------|-------|--------|
| S-029 | S-PLAN | Multi-maintainer quorum spec | `docs/quorum.md` |
| S-030 | S-BUILD | Multi-maintainer quorum implementation | governance.js extension + tests |
| S-031 | S-PLAN | MCP/HTTP bridge for SDK | `docs/mcp-bridge.md` |
| S-032 | S-BUILD | MCP server exposing Orbit read surface | Standard MCP wrapper |
| S-033 | S-BUILD | Plugin marketplace + reputation | Cross-repo aggregate stats |
| S-034 | S-BUILD | Holder utility — priority queue, premium rules | Token-gated features |
| S-035 | S-BUILD | Founder handoff narrative | Public cycle of "founder steps back" |
| S-036 | S-REVIEW | Phase 4 review | Network-effect scorecard |
| S-GATE-4 | S-GATE | Phase 4 sign-off | All criteria met |

---

## PHASE 5 — Persistence + Spec

**Goal:** Orbit outlives the founder. Spec is referenced. Token is durable.

**Duration:** Year 1+

**Success criteria for phase exit (S-GATE-5):**
- Spec published as standalone document (off-repo)
- ≥3 external implementations of the Orbit spec
- ≥100 adopter repos
- Treasury durably solvent without founder intervention
- ZK trust layer or smart-account execution shipped (whichever is more strategic at the time)

### Sessions

Sessions for this phase will be planned at S-GATE-4. Likely areas:

- ZK proof receipts (if narrative supports it)
- Smart-account execution (session keys, spend caps, guardian recovery)
- On-chain identity resolver (`orbit.<name>.eth` style)
- Cross-protocol bounty referrals (Gitcoin, Drips, Open Collective integrations)
- Spec publication + RFC process
- Founder handoff completion
- Constitutional amendments process for protocol-level changes

---

## Beyond Phase 5 — Eras

Phases 1–5 describe the *bootstrap* (everything up to and including founder-fade). After S-GATE-5, phases no longer fit — there is no "Phase 6 success criteria" that makes sense for a project intended to outlive any single roadmap horizon.

What replaces phases after S-GATE-5: **eras** and **currents**, defined in [FOREVER_ROADMAP.md](FOREVER_ROADMAP.md).

- **Currents** are continuous capability axes that deepen forever. Ten of them, listed in FOREVER_ROADMAP §3.
- **Eras** are nested epochs marked by adopter milestones, not dates. Era I (founder-fade) ends when Phase 5 exits. There is no terminal era.
- **The HORIZON_SCANNER** (see [SPECS/HORIZON_SCANNER.md](SPECS/HORIZON_SCANNER.md)) makes the roadmap literally self-extending — it scans the open web on a slower cadence and proposes new candidate specs under approval-gated promotion.

The phase model in this document remains load-bearing for everything up to Phase 5. Do not edit phases retroactively to reflect post-Phase-5 thinking; that's what FOREVER_ROADMAP exists for.

---

## Phase Transition Gates

Each `S-GATE-N` session must:
1. Verify every success criterion of the phase
2. Re-anchor the session plan based on actual learnings
3. Update `MEMORY/project-state.md` with the new baseline
4. Update `ROADMAP.md` with new explorations discovered
5. Cast publicly about phase completion
6. Mint a milestone receipt (signed, anchored)

If criteria are not met:
- Do NOT advance phase
- Add sessions to complete the gap
- Communicate publicly: "Phase N delayed because X, here's the work to close it"

Phase delays are not failures — silent phase skipping is.

---

## Critical Path

```
S-001 (this PLAN) → S-002 (signing) → S-003 (verifier) → S-007 (npm publish) → S-009 (closed-loop demo) → S-010 (review) → S-GATE-1
                                                                                                                      ↓
                                                                                                              S-011 (Clanker dry run)
                                                                                                                      ↓
                                                                                                              S-012 (TOKEN LAUNCH)
                                                                                                                      ↓
                                                                                                              S-013 (genesis cycle)
                                                                                                                      ↓
                                                                                                              Phase 2 → Phase 3 → ...
```

**Hard prerequisite chain:** No token launch without signing + closed-loop demo + 14-day stable cycles. No federation without ≥5 adopter repos. No standard publication without ≥50 adopters and ≥1 external implementation.

---

## What Gets Killed if Behind Schedule

If Phase 1 takes longer than 2 weeks, the things that come out (in order):
1. Verifier CLI (defer to month 2 — can launch with signed proofs and ship verifier later)
2. `create-orbit-repo` polish (ship rough version, polish later)
3. Lore beyond genesis (add over time)
4. Second adopter (force it pre-launch via friend; polish post-launch)

What NEVER gets killed:
- Signed proofs (this is the trust artifact)
- Treasury Safe (no launch without multisig)
- Closed-loop demo (the credibility moment)
- 14-day stable cycles (no launch without proven reliability)
- Dashboard at orbit.horse (public face)
