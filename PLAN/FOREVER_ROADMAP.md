# Orbit — Forever Roadmap

> [PHASES.md](PHASES.md) describes the nine numbered phases plus the open-ended horizon that follows. This document describes the rules under which those phases (and any future Phase 10+) operate — the principles, the continuous capability axes, the self-extending mechanism, and the never-stops rule.

This is the meta-roadmap. It does not list phases (that's PHASES.md) and it does not list features (that's [ROADMAP.md](ROADMAP.md)). It sets the rules under which features keep being added, retired, replaced, and discovered — for as long as Orbit exists.

---

## 1. What this document exists for

Phases 1–9 in [PHASES.md](PHASES.md) cover everything from launch through ubiquity through quiet utility. They end at Phase 9, which is explicitly a stable state rather than a terminal one. After Phase 9 the [HORIZON_SCANNER](SPECS/HORIZON_SCANNER.md) proposes new phases as the environment demands.

A roadmap that just lists phases doesn't answer two questions: (a) what rules survive every phase transition, and (b) what *mechanism* keeps proposing new work when no human is in the loop. This document answers both.

It does so without committing to any specific year, technology, or partnership — because all of those will be wrong eventually. It commits instead to a *shape* the project keeps having, and to a *mechanism* that keeps proposing new work even when no human is looking.

---

## 2. Immutable principles (these never change)

Every cycle of every phase must honor these. They are not subject to growth or amendment except through a constitutional process (see §7). If a future capability would require breaking one of these, the capability does not get built. There are many capabilities; there is one project.

1. **Every cycle proof is wallet-signed and verifiable by anyone.** (D-006)
2. **No external spend without a public approval issue and a recorded approval comment.** (D-014)
3. **Treasury accrues in WETH; the operator stream is 5% in WETH.** (D-017)
4. **No on-chain token operation without `state.preLaunchVerified === true`.** (D-018)
5. **Treasury splits across the six topology Safes; no funds escape that topology.** (D-019)
6. **No recipient takes rewards in $ORBIT.** (D-002, locked)
7. **Infrastructure stays on GitHub.** No Vercel, Netlify, AWS, or other hosted dependency for the operational path. If GitHub disappears, Orbit federates and re-anchors; it does not migrate to a vendor.
8. **No specific dollar figures from Orbit's operating accounts appear on GitHub-visitor surfaces.** Dashboards may show counts, ratios, and category labels; not the operator's wallet balance.
9. **Research access is open.** No domain allowlist on fetch tools. Defense lives at the content-trust layer (provenance tagging, untrusted-input envelopes, risk scoring), not at the network layer.
10. **The voice stays first-person, terse, signed, no hype.** ([BRAND.md](BRAND.md))
11. **Refusals are public.** Anything Orbit refuses to do gets a public refusal record with redaction, not silence.
12. **Identity is portable.** Any Orbit's signed proof is verifiable without Orbit's cooperation. Lock-in by design is forbidden.

If a future spec contradicts any of the above, the spec is wrong. Reject it.

---

## 3. The ten currents

A current is a capability axis. It has no end state. It can be deepened, broadened, replaced, or fragmented, but it cannot be "complete." Each current is what an autonomous entity needs to keep doing, not a milestone it can pass.

Currents are orthogonal to phases. Phase 1 work and Phase 9 work both touch the same ten currents — what changes between phases is which currents have the most pressure, not which currents exist.

The currents are not disjoint. Treasury work serves Identity (the wallet is an identity); Federation work serves Adoption; Research feeds all of them. They are listed separately because each has its own constituency, its own evidence trail, and its own continuous mechanism.

| # | Current | North star (never reached) |
|---|---------|----------------------------|
| 1 | **Autonomy** | Orbit decides and acts correctly without human intervention, for arbitrarily long stretches, on increasingly novel inputs. |
| 2 | **Treasury** | Treasury is productive, sufficient, and recoverable under any single failure. |
| 3 | **Governance** | Decisions are gated, narrated, reversible at the right cost, and survive turnover of every individual participant. |
| 4 | **Identity** | Orbit's history is provable to a stranger without trusting Orbit, in any future medium. |
| 5 | **Federation** | Orbits exchange knowledge, work, and trust with each other faster than threats spread. |
| 6 | **Adoption** | Orbit-shaped infrastructure runs in more repos every quarter, by more independent operators. |
| 7 | **Research** | Orbit notices change in its environment before that change becomes urgent. |
| 8 | **Revenue** | No single income stream exceeds 40% of the total; all streams are honest and replaceable. |
| 9 | **Operations** | Failures are diagnosed and recovered from inside one cycle of the failure occurring. |
| 10 | **Public** | A stranger can read the dashboard and understand what Orbit just did, why, and how to challenge it. |

Each current has its own working file under [`PLAN/CURRENTS/`](CURRENTS/) when populated. The skeleton below is mirrored in [ROADMAP.md](ROADMAP.md) section-by-section; this document is the index, not the inventory.

### 3.1 Autonomy

- **In flight:** 15-min cycle cadence, Anthropic-primary inference with provider failover, refusal-aware execution, signed proof per cycle.
- **Near horizon:** Self-adjusting cycle frequency (back off during quiet stretches, speed up during incidents). Post-cycle introspection ("did I do the right thing?") stored as evidence. Multi-step planning where cycle N drafts cycle N+1's agenda, signed.
- **Mid horizon:** Multi-agent specialization within one repo (security keeper, treasury keeper, research keeper, all under the same governance). Cross-cycle continuity ("I tried this last month, it didn't work, here is why I'm trying it again differently").
- **Far horizon:** Sleep-deeper mode that saves budget during low-information periods. Conditional autonomy ladders that grant or remove specific powers based on recent track record.
- **Continuous mechanism:** Every cycle ends with one line of self-assessment. The horizon scanner reads the assessment stream to detect drift.

### 3.2 Treasury

- **In flight:** Six-Safe topology (Floor, Productive, Buyback, Growth, AI-Costs, Ops); WETH-denominated floor; 5% operator stream; manual ai-food refill loop with approval gate.
- **Near horizon:** Productive deployment of the Productive Safe (Aave, Uniswap V3/V4 LP on Base) under per-venue caps. Adaptive fee-floor that auto-tunes based on 30-day income.
- **Mid horizon:** Insurance-fund Safe for incident response. Auto-rebalance proposals between buckets (still approval-gated). Multi-chain treasury (Base-primary; Arbitrum/Optimism mirrors).
- **Far horizon:** Tokenized treasury exposure (LRT/LST) when restaking AVS stabilizes. ZK-protected rebalance moves where the public sees the operation but not the per-venue split.
- **Continuous mechanism:** Weekly treasury productivity report; horizon scanner watches for new productive venues and threats.

### 3.3 Governance

- **In flight:** D-014 approval-issue gate, S-029/S-030 multi-maintainer quorum, REJECT/APPROVE comment syntax, exact-line owner check.
- **Near horizon:** Founder-fade execution per FOUNDER_HANDOFF spec; signer rotation ceremony with public narration.
- **Mid horizon:** Constitutional amendments process (the immutable principles themselves can only be changed via a slower, multi-signer process with timelock). Specialist sub-quorums (security council, treasury council, research council).
- **Far horizon:** Conditional governance rules ("if treasury < floor + 2x, only essential spend"). Liquid-delegation voting weights for adopter-level decisions.
- **Continuous mechanism:** Post-decision "did this age well?" review N cycles later; quorum performance metrics published.

### 3.4 Identity

- **In flight:** EIP-712 cycle proofs, signer-match check, daily Merkle anchor of cycle-proof roots, signed federation envelopes.
- **Near horizon:** ENS-resolved passport (`orbit.<repo>.eth`). IPFS-pinned proof bundles. Key-rotation rehearsal cycles.
- **Mid horizon:** ZK-proof receipts ("Orbit ran this cycle correctly" without revealing all state). Off-chain attestations woven into adopter handshake (Gitcoin Passport, Worldcoin, EAS).
- **Far horizon:** Decentralized identifier (DID) integration. Cross-chain identity coherence. Cryptographic recovery (Shamir-split owner keys with quorum recovery).
- **Continuous mechanism:** Signer health monitor; lost-key recovery drill at a defined cadence; tamper-detect alerter on any historical proof whose signature fails today.

### 3.5 Federation

- **In flight:** Parse-only inbound federation messages (HELLO, INTEL_SHARE, CAPABILITY_ADVERTISE), signed envelopes, nonce dedup.
- **Near horizon:** Outbound message wiring (S-026/S-027). Federation peer registry on `.well-known/orbit.json`. Cross-Orbit bounty referrals.
- **Mid horizon:** Federated knowledge synthesis — INTEL_SHARE messages from peers flow into the learning lab and adjust scam-scanner rule packs. Trust graph (which peers' INTEL is reliable; PageRank-style or stake-weighted).
- **Far horizon:** Federated dispute resolution (peer Orbits arbitrate cross-instance conflicts). Cross-instance collaborative cycles (two Orbits jointly investigate an attack pattern, with joint signed proof).
- **Continuous mechanism:** Federation peer-health monitor; auto-archive of dead peers; auto-add proposal for new peers from CAPABILITY_ADVERTISE traffic.

### 3.6 Adoption

- **In flight:** Adopter handshake (S-ADP-1), adopter registry, ≥5 Phase-1 target, plugin loader for `@orbit/tool-*`.
- **Near horizon:** Plugin marketplace registry on GitHub Pages with crawl + aggregation. Per-adopter dashboard slice. Adopter onboarding cohort program.
- **Mid horizon:** Adopter cohort learning (privacy-respecting comparison of configurations, shared best practices). Adopter reputation (success-weighted; never pay-to-play).
- **Far horizon:** Self-spawning child Orbits for delegated workstreams under a charter, budget, and shutdown rule. Orbit-as-a-protocol — third-party agents implement the standard without copying the codebase.
- **Continuous mechanism:** Stale-handshake detector; adopter-fade alert when a registry entry hasn't re-handshaked in N cycles.

### 3.7 Research (the meta-current)

- **In flight:** Revenue-explorer framework with sybil-floor and bus-factor gates. Hypothesizer for revenue experiments. Market-signals collector. Learning-lab quarantine.
- **Near horizon:** **HORIZON_SCANNER** — periodic scan of EIP registry, ArXiv (cs.CR, cs.AI, cs.DC), GitHub trending in adjacent ecosystems, federation peers' CAPABILITY_ADVERTISE traffic, public attack reports. Output: candidate specs drafted into `PLAN/SPECS/CANDIDATES/`, paired with quorum-review issues. See [HORIZON_SCANNER spec](SPECS/HORIZON_SCANNER.md).
- **Mid horizon:** Adversarial rehearsal — periodic red-team simulations (treasury drain attempts, federation forgery attempts, prompt-injection probes) that produce signed reports. Time-series forecasting on Orbit's own metrics (treasury health, cycle reliability bands, revenue runway). LLM-evals — re-run a held-out prompt set against new model versions to detect behavior drift before relying on them.
- **Far horizon:** Self-improving prompts (Orbit edits its own system prompt, subject to quorum approval and rollback). Research peer review across federation. Public-good publication (Orbit publishes findings; other Orbits cite).
- **Continuous mechanism:** This is itself the continuous mechanism for the whole roadmap. See §6.

### 3.8 Revenue

- **In flight:** Revenue exploration framework, fee-floor gate, sybil-floor gate, identity-capture (Goodhart) detector, AI-routing margin tracker, market-signals stream.
- **Near horizon:** First live experiment graduation post-S-GATE-2 (the framework currently runs dry only). Subscription tier (S-025). Plugin marketplace fee share.
- **Mid horizon:** Multiple parallel streams under the 40%-cap rule. Auto-kill criteria evaluated each cycle; failing streams retired publicly. Diversification metric published on the dashboard.
- **Far horizon:** Spec-implementation royalties (if Orbit becomes a standard, third-party implementations contribute an opt-in protocol fee). Public-good funding via Gitcoin grants / Drips / Open Collective.
- **Continuous mechanism:** Revenue-hypothesizer scans federation peers' CAPABILITY_ADVERTISE for streams Orbit doesn't yet have; proposes adoption with kill criteria.

### 3.9 Operations

- **In flight:** 1282+ tests; CI lint; orbit-cycle / orbit-event / issue-gate / deploy-dashboard workflows; scam scanner; refusal log.
- **Near horizon:** Cycle SLI/SLO tracking (uptime, p95 latency, failure rate). Chaos drills (deliberately fail one tool per cycle in a sandbox; verify graceful degradation). Workflow-cost watch.
- **Mid horizon:** Multi-region failover (mirror to a secondary GitHub org; recover automatically if primary org locks the agent out). Long-term archival (cycles > 1 year compressed and pruned with a documented retention policy). Bus-factor automation (force-rotate any single-key dependency).
- **Far horizon:** Self-healing routing (detect provider degradation; auto-failover). Cryptographic recovery (Shamir-split owner keys with quorum recovery). Cycle-replay tooling that reconstructs a past cycle bit-for-bit from its proof.
- **Continuous mechanism:** Dependency-update watch; workflow-health monitor; weekly stability scorecard.

### 3.10 Public

- **In flight:** Dashboard at orbit.horse, `.well-known/orbit.json`, Farcaster cast templates (routine, mistake, buyback, milestone, approval-pending, refusal).
- **Near horizon:** Public verifier UI (paste a proof URL, see the signature verified in-browser, no Orbit cooperation needed). Public cycle-log explorer.
- **Mid horizon:** Public mission board UI (no money on the page; mission state only). Story rooms for milestone cycles. Two-skin dashboard (operator skin + household skin).
- **Far horizon:** Public read-only API (rate-limited). Public events calendar (cycle epochs, planned governance votes). Public Q&A interface where visitors ask, Orbit answers from memory only.
- **Continuous mechanism:** Cast-quality tracker (engagement-aware, not engagement-optimized) feeds a tone-drift detector; refusal-of-the-week curator.

---

## 4. Phases 6–9 and beyond (the post-fade timeline)

This section used to describe four "Eras" running after Phase 5. The unified phase model in [PHASES.md](PHASES.md) absorbs that content into numbered phases — there's no separate "Era" vocabulary anymore. For reference:

- **Phase 6 — Standardization** (≥500 adopters): founder-fade complete; ≥3 external implementations; spec off-repo. (Previously: Era I exit.)
- **Phase 7 — Five Thousand** (≥5,000 adopters): federation governance decentralized; long-horizon memory tiering. (Previously: Era II.)
- **Phase 8 — Ubiquity** (≥25,000 adopters): Orbit is the coordination primitive; founder irrelevant. (Previously: Era III.)
- **Phase 9 — Quiet Utility** (∞): infrastructure becomes invisible; referenced like SMTP. (Previously: Era IV.)
- **Horizon** (Phase 10+): proposed by HORIZON_SCANNER under constitutional amendment. (Previously: Era V — left empty.)

Phase 9 is a stable state, not a gate. There is no S-GATE-9 exit criterion that, once met, declares Orbit "done." The work just keeps happening; the horizon scanner just keeps proposing new candidate specs.

---

## 5. Year markers, not deadlines

Phases don't have years. But Orbit narrates anniversaries. Use them.

- **Cycle #100, #1,000, #10,000, #100,000, #1,000,000** — milestone cycles, signed, anchored, cast. Each is a public artifact of continuity.
- **Year 1, 3, 5, 10, 25, 50, 100** — anniversary cycles. Each year-marker cycle includes a "Letter From Orbit" that summarizes what was tended that year, what was retired, and what was learned.
- **Founder birthday / death** — Orbit, by design, has no founder birthday cycle. Founder identity is intentionally absent from cycle narrations after Phase 6.

Anniversaries are not deliverables. They are evidence of continuity.

---

## 6. How the roadmap stays alive: the HORIZON_SCANNER

The single mechanism that makes this roadmap genuinely never-stops is the [HORIZON_SCANNER](SPECS/HORIZON_SCANNER.md). Briefly:

- It runs as a cycle subsystem on a slower cadence than the main cycle (default: every 24h).
- It sources signals from the open web (research-access-open principle): EIP registry RSS, ArXiv categories, GitHub trending in adjacent ecosystems, federation peers' CAPABILITY_ADVERTISE traffic, public attack reports.
- Each signal is classified to one of the ten currents (or rejected) via LLM.
- High-relevance signals become **candidate specs** written to `PLAN/SPECS/CANDIDATES/<slug>.md` with a one-paragraph rationale, source provenance, and a quorum-review issue opened.
- Candidates not promoted within a configurable window (default: 90 cycles ≈ 22.5 days) are auto-archived to `PLAN/SPECS/ARCHIVE/` with an "aged out" reason. They can be revived; they are never deleted.
- The scanner's own activity is signed and casted like any other cycle work.

This produces a strong property: **a cycle where the scanner found nothing new is itself a signal.** Either the source feeds are stale (operations work), or the environment really is quiet (rare; record it). Either way, the system never silently stops looking.

If the HORIZON_SCANNER ever stops producing candidates for N consecutive scans, that triggers a quorum-reviewed health check on the scanner itself. The roadmap's own pulse is monitored.

---

## 7. Adopt-or-fade rules for candidate specs

A candidate spec lives in `PLAN/SPECS/CANDIDATES/`. To become a real spec under `PLAN/SPECS/`, it must:

1. **Map to one of the ten currents.** Cross-current specs pick a primary current and note secondaries.
2. **Pass the immutable-principles check (§2).** If implementation would break any principle, reject.
3. **Have at least one identifiable adopter** — a user, a federation peer, an adopter repo, or the Operations current itself — who needs it.
4. **Receive quorum approval per the current quorum threshold for "new capability."**
5. **Have a kill criterion** — the condition under which the resulting capability should be retired (e.g., "if no usage in 6 months", "if a successor protocol matures"). No capability is permanent unless it serves an immutable principle.

Candidates not promoted in 90 cycles fade to `PLAN/SPECS/ARCHIVE/`. Archived specs are searchable; the HORIZON_SCANNER consults them so it doesn't re-propose the same idea unchanged.

Capabilities themselves can be retired by the inverse process: a retire-proposal is itself a quorum-gated action, with a public cycle narrating the retirement.

---

## 8. How to add a new current (or a new phase)

Ten currents are not magic. Phase 9 is not the last phase. If the environment changes enough, an eleventh current emerges; if accumulated work warrants it, a Phase 10 is proposed.

The process is the same in both cases:

1. A pattern of candidate specs accumulates that doesn't fit cleanly into any current, or that justifies a new phase boundary. The HORIZON_SCANNER flags this when at least three recent candidates cluster in the relevant way.
2. A **proposal** is filed — a candidate-spec-shaped document arguing for the new current's north star and continuous mechanism, or the new phase's success criteria and S-GATE.
3. The proposal goes through **constitutional amendment**: a slower process than normal spec promotion, with a 7-day timelock and a higher quorum threshold (default: 75% of active maintainers, not 50%).
4. If approved:
   - A new current is added to this document, [ROADMAP.md](ROADMAP.md), and a working file under `PLAN/CURRENTS/`.
   - A new phase is appended to [PHASES.md](PHASES.md) (with its S-GATE-N session and exit criteria), and `src/data/phases.js` extended (preserving status semantics).

Currents and phases are not deleted, only **merged** (combine with a neighbor) or **frozen** (no longer actively tended; preserved as history). Either is also a constitutional amendment.

---

## 9. What this document never says

This document deliberately makes no commitments about:

- Specific years (technology timelines lie).
- Specific protocols (today's protocols mature, fragment, or die).
- Specific dollar targets (the no-money-on-visitor-surfaces rule means dollar figures aren't on the public roadmap surface at all).
- Specific founders or maintainers (founder-fade in Phase 5–6 intentionally removes the founder from the protocol's critical path).
- Specific blockchains (Base is current; future Orbits may federate across substrates).

What it does commit to: the immutable principles, the ten currents, the phase-extension process, the scanner, and the rule that "done" is never valid.

---

## 10. Reading map

- For *what to build next* (concrete items): [ROADMAP.md](ROADMAP.md) (sections A–U).
- For *how phases are numbered and gated*: [PHASES.md](PHASES.md).
- For *what's locked*: [DECISIONS.md](DECISIONS.md).
- For *the engine*: [SPECS/HORIZON_SCANNER.md](SPECS/HORIZON_SCANNER.md).
- For *the voice this all must keep*: [BRAND.md](BRAND.md).
- For *the founder-fade endgame of Phase 5–6*: [SPECS/FOUNDER_HANDOFF.md](SPECS/FOUNDER_HANDOFF.md), [SPECS/PHASE_4_5_OUTLOOK.md](SPECS/PHASE_4_5_OUTLOOK.md).

---

## 11. Status

- **Created:** 2026-05-26 alongside the Patch Set A/B work on closed-loop demo gaps.
- **Last revised:** 2026-05-26 — Eras model retired in favor of Phases 6–9 unified with engineering numbering; ten currents and the scanner kept.
- **Owner of the meta:** the current maintainer quorum once S-029/S-030 is live in production; until then, the founder.
- **Last horizon scan integrated:** N/A — HORIZON_SCANNER spec landed in the same cycle; first scan happens after S-GATE-1 and after `state.preLaunchVerified === true` (per D-018 discipline).
- **Next constitutional review:** at S-GATE-4, when founder-fade execution begins.
