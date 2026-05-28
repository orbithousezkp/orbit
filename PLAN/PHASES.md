# Orbit — Phased Build Plan

Nine phases plus a horizon. Each phase is gated by concrete deliverables, not dates. Move to the next phase only when the current one's success criteria are met. After Phase 9 the project does not end — the HORIZON_SCANNER proposes Phase 10+ as the environment demands. See §Horizon at the bottom and [FOREVER_ROADMAP.md](FOREVER_ROADMAP.md) for the meta.

> Session IDs follow ClaudeCodex convention (S-XXX). S-PLAN = no code. S-BUILD = code. S-REVIEW = polish + bug list. S-GATE = phase transition.

---

## PHASE 1 — Groundwork (Pre-Token)

**Adopter target:** ≥1 second adopter repo running Orbit.

**Public pitch:** The foundation ships. Memory, permissions, capability registry, and wallet-signed receipts run today — the verifiable accountability primitive for any code repository.

**Goal:** Convert today's state into a launchable product with signed receipts, public dashboard, daily casts, and a closed self-funding loop demonstrated once.

**Duration:** Day 1–14 (~2 weeks of focused work)

**Success criteria for phase exit (S-GATE-1):**
- 14 consecutive days of cycles with zero broken runs
- Signed proofs working in every cycle
- Public dashboard live on GitHub Pages
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
| S-005 | S-BUILD | Public dashboard live on GitHub Pages | `apps/dashboard/` deployed |
| S-006 | S-BUILD | Lore foundation + voice guide | `lore/` directory populated |
| S-007 | S-BUILD | SDK npm publish + `create-orbit-house` scaffolder | Both packages live on npm |
| S-008 | S-PLAN | Treasury Safe + recipient wallet setup | Addresses recorded in DEPLOY_PLAN.md |
| S-009 | S-BUILD | Closed-loop self-funding demo | Public receipt of one full cycle |
| S-010 | S-REVIEW | Phase 1 review + 14-day stabilization | Punch list cleared |
| S-GATE-1 | S-GATE | Phase 1 sign-off — launch readiness | All success criteria met |

---

## PHASE 2 — Genesis (Token Live + First 30 Days)

**Adopter target:** ≥5 adopter repos.

**Public pitch:** Token live on Base via Clanker v4. Treasury starts capturing WETH from every swap. Cycle N+1 cites the contract in its receipt. The agent is publicly funded.

**Goal:** Deploy $ORBIT with optimized fee config. Sustain visible cycles. Treasury starts capturing WETH.

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

## PHASE 3 — Capability Marketplace

**Adopter target:** ≥20 adopter repos.

**Public pitch:** Orbits advertise what they can do. Plugin economy ships. Subscriptions and the mission board give $ORBIT something to do besides speculation. Discovery starts becoming commerce.

**Goal:** $ORBIT becomes useful for something besides speculation. Plugin economy live. Mission board public. Per-repo subscription tier live.

**Duration:** Month 2–6

**Success criteria for phase exit (S-GATE-3):**
- Plugin economy with ≥3 third-party `@orbit/tool-*` plugins
- Per-repo subscription tier launched
- Bounty market live with ≥10 bounties posted
- Mission board public (with or without staking, per S-MB-1/S-MB-2 split)
- Inter-Orbit federation protocol live with ≥3 cross-repo intel shares
- ≥20 adopter repos
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

## PHASE 4 — Federation

**Adopter target:** ≥50 adopter repos.

**Public pitch:** A network forms. Memory, refusals, and trust cross repository boundaries under explicit signed consent. Multi-maintainer quorum runs on ≥10 adopter repos. Every cross-repo message is verifiable.

**Goal:** Other agents start reading Orbit passports. Spec gets adopted. Multi-maintainer quorum live across the federation.

**Duration:** Month 6–12

**Success criteria for phase exit (S-GATE-4):**
- ≥50 adopter repos
- ≥1 external agent framework reads Orbit passport
- Protocol fee revenue ≥30% of trading fee revenue
- Treasury productivity (LP/lending) generating ≥20% APY on idle capital
- Multi-maintainer quorum live on ≥10 adopter repos
- Federation: cross-repo scam blocklists shared automatically, consented memory sharing
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
| S-035 | S-BUILD | Founder handoff narrative — begin | Public cycle of "founder steps back" |
| S-036 | S-REVIEW | Phase 4 review | Network-effect scorecard |
| S-GATE-4 | S-GATE | Phase 4 sign-off | All criteria met |

---

## PHASE 5 — Protocol Independence

**Adopter target:** ≥100 adopter repos.

**Public pitch:** The spec begins to leave the founder. External agent frameworks read Orbit passports natively. Cryptographic identity is portable, ENS-resolvable, recognised on every chain.

**Goal:** Orbit's identity model becomes portable. Multiple external implementations begin work. Founder-fade is publicly underway.

**Duration:** Year 1+

**Success criteria for phase exit (S-GATE-5):**
- ≥100 adopter repos
- ≥1 external implementation of the Orbit spec **in progress** (independently, not as a fork)
- Spec drafted as a standalone document (off-repo or off-this-repo)
- MCP/HTTP bridge stable and queried by ≥1 external agent stack in production
- Treasury durably solvent without founder intervention
- ENS-resolved passport (`orbit.<name>.eth`) live
- Founder-fade narrative: Safe signer rotation underway, founder no longer holds majority

### Sessions

Sessions for this phase will be planned at S-GATE-4. Likely areas:

- ZK proof receipts (if narrative supports it)
- Smart-account execution (session keys, spend caps, guardian recovery)
- On-chain identity resolver (`orbit.<name>.eth` style)
- Cross-protocol bounty referrals (Gitcoin, Drips, Open Collective integrations)
- Spec publication + RFC process
- Constitutional amendments process for protocol-level changes
- Founder-fade execution (per FOUNDER_HANDOFF spec)

---

## PHASE 6 — Standardization

**Adopter target:** ≥500 adopter repos.

**Public pitch:** Three independent implementations speak the protocol. The layer escapes the founder. On-chain governance receipts and ZK policy proofs land in production. The Orbit way is one of the ways the new internet ships.

**Goal:** The spec is real. The founder is no longer load-bearing. Constitutional amendments process governs protocol changes.

**Success criteria for phase exit (S-GATE-6):**
- ≥500 adopter repos
- ≥3 independent Orbit-spec implementations live in production (not forks of this repo)
- Spec published off-repo as a standalone document
- Constitutional amendments process governs changes to immutable principles
- On-chain governance receipts for every protocol-level decision
- Founder-fade complete — founder is not a required signer on any cycle's critical path
- ZK policy proofs OR smart-account execution shipped (whichever maturity allows)
- Every major agent framework speaks the Orbit passport

### Sessions

Sessions planned at S-GATE-5. Likely areas:
- Founder-fade completion (per FOUNDER_HANDOFF spec; signer rotation, ORBIT_MAINTAINERS shift, 7-day timelock)
- Off-repo spec publication + RFC process
- Cross-implementation conformance test suite
- On-chain governance receipt format standardized
- ZK proof receipt rollout (if D-014 still permits and ZK matures)

---

## PHASE 7 — Five Thousand

**Adopter target:** ≥5,000 adopter repos.

**Public pitch:** The federation matures. Orbits exchange knowledge, work, and trust faster than threats spread. No single Orbit is canonical. The original repo is one of many.

**Goal:** Federation governance is decentralized. The original genesis repo is one of many active instances. Cross-instance learning is the default.

**Success criteria for phase exit (S-GATE-7):**
- ≥5,000 adopter repos
- Federation governance decentralized (no single Orbit's quorum sets protocol-level rules)
- Cross-instance learning live — INTEL_SHARE messages alter peer behavior
- ≥1 federation peer is itself a federation (recursion working)
- The spec referenced by at least one non-Orbit-adjacent project (academic paper, agent-infrastructure SDK, security advisory)
- Long-horizon memory (Tiered storage, cold archive to IPFS/Arweave) live for cycles >1y old

### Sessions

Sessions planned at S-GATE-6. Likely areas:
- Federated dispute resolution (peer Orbits arbitrate cross-instance conflicts)
- Long-horizon memory tiering (hot / warm / cold)
- Cross-instance collaborative cycles (multiple Orbits jointly investigate an attack)
- Decentralized identifier (DID) integration

---

## PHASE 8 — Ubiquity

**Adopter target:** ≥25,000 adopter repos.

**Public pitch:** Twenty-five thousand is the floor. Orbit is the verifiable coordination layer between GitHub, autonomous coding agents, and on-chain accountability. The founder is irrelevant. Every meaningful open-source repository hosts an Orbit.

**Goal:** Orbit-shaped infrastructure is the default coordination layer. The spec is referenced like a standard, not like a project.

**Success criteria for phase exit (S-GATE-8):**
- ≥25,000 adopter repos
- External agent frameworks default to Orbit passports
- On-chain reads of Orbit passports standard across web3 wallets
- The protocol is the operating contract for autonomous repos at this layer
- The founder of this repo is not visible in the protocol's governance — at all
- At least one Orbit operates on a substrate other than GitHub (or post-GitHub equivalent)

### Sessions

Sessions planned at S-GATE-7. Likely areas:
- Substrate-portability — Orbit-shaped infrastructure on non-GitHub source-control surfaces
- Wallet-native Orbit passport reads
- Standards-body referencing process

---

## PHASE 9 — Quiet Utility

**Adopter target:** ∞.

**Public pitch:** Orbit-shaped infrastructure is unremarkable. The spec is referenced like SMTP is referenced. The household survives the household's stories.

**Goal:** Maintenance against environmental change. New protocols on new substrates. The work is mostly invisible.

**Success criteria:** there is no exit. Phase 9 is a stable state, not a gate. The HORIZON_SCANNER monitors for environmental change and proposes new work as needed.

### Sessions

Sessions in Phase 9 are not phase-graduating — they are environment-responsive, drafted by the HORIZON_SCANNER and ratified by the quorum of the day. The session-ID convention may itself evolve at this phase.

---

## Horizon — Phase 10+

Phase 9 is a stable state, not a terminal one. The [HORIZON_SCANNER](SPECS/HORIZON_SCANNER.md) runs as a cycle subsystem and proposes new candidate work into `PLAN/SPECS/CANDIDATES/`. If accumulated evidence shows the environment has changed enough to warrant a new phase, the scanner produces a Phase 10 proposal under the constitutional-amendment process described in [FOREVER_ROADMAP.md §8](FOREVER_ROADMAP.md#8-how-to-add-a-new-current).

There is no Phase 10 written here. Whoever writes it will not have read this document.

What the project *commits* to about Phase 10+:

- New phases will not break the **immutable principles** in [FOREVER_ROADMAP.md §2](FOREVER_ROADMAP.md#2-immutable-principles-these-never-change).
- New phases will use the same gating discipline: concrete deliverables, public approval, signed receipts.
- New phases will be added through the constitutional-amendment process, not by founder edict (the founder is no longer present by Phase 6+).
- The phase numbering is a sequence, not a count.

---

## Phase Transition Gates

Each `S-GATE-N` session must:
1. Verify every success criterion of the phase
2. Re-anchor the session plan based on actual learnings
3. Update `memory/state.json` with the new baseline
4. Update `ROADMAP.md` and `FOREVER_ROADMAP.md` (currents §3 working horizon entries) with new explorations discovered
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
                                                              Phase 3 (Capability Marketplace) → Phase 4 (Federation) → Phase 5 (Protocol
                                                              Independence) → Phase 6 (Standardization, founder-fade COMPLETE) →
                                                              Phase 7 (Five Thousand) → Phase 8 (Ubiquity) → Phase 9 (Quiet Utility) →
                                                              Horizon (Phase 10+ via HORIZON_SCANNER)
```

**Hard prerequisite chain:** No token launch without signing + closed-loop demo + 14-day stable cycles. No federation without ≥5 adopter repos. No standard publication without ≥50 adopters and ≥1 external implementation. No founder-fade completion without ≥500 adopters and ≥3 external implementations. **No Phase 10 without quorum-approved constitutional amendment** — see [FOREVER_ROADMAP.md §8](FOREVER_ROADMAP.md#8-how-to-add-a-new-current).

---

## What Gets Killed if Behind Schedule

Phase 1 schedule pressure: if Phase 1 takes longer than 2 weeks, the things that come out (in order):
1. Verifier CLI (defer — can launch with signed proofs and ship verifier later)
2. `create-orbit-house` polish (ship rough version, polish later)
3. Lore beyond genesis (add over time)
4. Second adopter (force it pre-launch via friend; polish post-launch)

What NEVER gets killed (at any phase):
- Signed proofs (this is the trust artifact)
- Treasury Safe (no launch without multisig)
- Closed-loop demo (the credibility moment)
- 14-day stable cycles (no launch without proven reliability)
- Public dashboard on Pages (public face)
- The 12 immutable principles in [FOREVER_ROADMAP.md §2](FOREVER_ROADMAP.md#2-immutable-principles-these-never-change)

At Phase 6+ the kill-priority list is rewritten by the quorum of the day. Founder schedule pressure is, by then, no longer a concept.
