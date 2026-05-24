# Orbit — Locked Decisions

> Append-only log. Every architectural or strategic decision that future sessions must follow. Format: D-XXX. Never edit a closed decision — supersede it with a new D-XXX referencing the old one.

---

## D-001 — Use ClaudeCodex protocol structure for plan + future build sessions

**When:** 2026-05-23
**Session:** S-001 (this plan)
**Decision:** Plan documents follow ClaudeCodex format (`MASTER_PLAN.md`, `PHASES.md`, etc.). Sessions follow S-XXX numbering. Status tracked in `STATUS.md`. Knowledge persisted in `DECISIONS.md` + `LEARNINGS.md`.
**Why:** Owner explicitly requested it. Structure forces discipline around sessions, gates, threat models, research currency. Compatible with both public and private repo workflows.
**Implication:** All future planning work uses this structure. Build sessions follow the SUBSESSION LOOP from `START_HERE.md`.

---

## D-002 — All Clanker v4 fee recipients accrue rewards in `Paired` (WETH), not in `Clanker` ($ORBIT)

**When:** 2026-05-23
**Session:** S-001
**Decision:** Every reward recipient configured at $ORBIT deploy time takes rewards in the paired token (WETH). One exception: the Bounty Pool recipient (small share) takes `Both` because it needs some $ORBIT inventory to pay bounties.
**Why:** Token recipients dump. If treasury accrues $ORBIT, dumps directly bleed the treasury. If treasury accrues WETH, the treasury grows independent of $ORBIT price action. This is the floor.
**Implication:** `CLANKER_FEE_STRATEGY.md` allocation table is the contract. Any change requires a new D-XXX entry. Buyback flow (D-005) handles converting WETH back to $ORBIT when desired, on-cycle, with public approval.

---

## D-003 — Deploy via clanker.world frontend, NOT via @clanker Farcaster bot

**When:** 2026-05-23
**Session:** S-001
**Decision:** Token launch goes through clanker.world UI with manual recipient config, not via the @clanker bot.
**Why:** Frontend deploys allow full recipient customization (up to 7) with explicit `Paired` token denomination per recipient. Bot deploys default to creator receiving rewards, with less flexibility. Confirmed against Clanker v4 docs.
**Implication:** Deploy is a manual one-time owner action, not automated. Pre-deploy checklist in `CLANKER_FEE_STRATEGY.md` is the runbook.

---

## D-004 — Treasury custody is a Safe multisig on Base before token deploys

**When:** 2026-05-23
**Session:** S-001
**Decision:** Treasury is a Gnosis Safe deployed on Base, 2-of-3 signers minimum, deployed and funded before the Clanker launch transaction.
**Why:** Single-key custody at launch creates an unacceptable rug-pull narrative, regardless of intent. Multisig is observable on Basescan and signals operational seriousness. Also aligns with the "approval gates" story we already tell.
**Implication:** Cannot launch token without Safe ready. Signers and threshold recorded in `DEPLOY_PLAN.md`. Safe address is the `ORBIT_TREASURY_ADDRESS` env var.

---

## D-005 — Weekly $ORBIT buybacks funded from the Buyback Wallet's WETH balance, under approval gate

**When:** 2026-05-23
**Session:** S-001
**Decision:** Once per week, Orbit reads the Buyback Wallet's WETH balance, files an approval issue ("Buy back $ORBIT with X WETH"), waits for owner approval, then executes via a configured router (e.g. Uniswap router on Base). Bought-back $ORBIT goes to either burn or vesting — TBD in S-014.
**Why:** Provable deflationary mechanism. Visible in cycle proofs. Token-utility signal independent of price action. Slot 2 in the fee allocation (15% of fees in WETH) feeds this.
**Implication:** Phase 2 work item. New `src/agent/buyback.js`. New tool entry. Burn-vs-vest decision deferred but must be made before first buyback.

---

## D-006 — Every cycle proof signed with the agent wallet key before launch

**When:** 2026-05-23
**Session:** S-001
**Decision:** Every JSON proof written under `runtime/proofs/` includes a `signature` field (eth-style ECDSA over the proof payload) using `ORBIT_WALLET_PRIVATE_KEY`. The signer address (derivable from the signature) must match a published `ORBIT_AGENT_SIGNER` address.
**Why:** This is the trust artifact the entire architecture rests on. Without signatures, receipts are JSON files anyone could fabricate. With signatures, they're cryptographic proofs anyone can verify with no trust in the repo or its owner.
**Implication:** S-002 (Phase 1) implements this. Without it, no launch. SDK `readReceipts` extended to verify signatures and return verified/unverified status.

---

## D-007 — Public dashboard hosted at orbit.horse, NOT the household-metaphor app

**When:** 2026-05-23
**Session:** S-001
**Decision:** `orbit.horse` hosts a public read-only dashboard showing: cycle counter, latest signed receipt, treasury Safe balance, last 10 actions, blocked-actions list. The existing "household" UI in `src/App.jsx` is repurposed/simplified for this dashboard.
**Why:** Public face must be operations-focused for the launch audience. The household metaphor is *brand*, not *dashboard*. Owner already owns the domain.
**Implication:** Dashboard is its own deploy target (Phase 1 work). Hosted on GitHub Pages only per the github-only constraint (`.github/workflows/deploy-dashboard.yml`, `public/CNAME`). No Vercel.

---

## D-008 — Farcaster casting is wired into the cycle loop, not external automation

**When:** 2026-05-23
**Session:** S-001
**Decision:** Cycle posting to Farcaster happens via a `cast_to_farcaster` tool called within the cycle, not via a separate Github Action or external service. This means casts are themselves part of the cycle proof.
**Why:** If casting is external, the cast can drift from what the cycle actually did. Putting it in-cycle ties the cast to the receipt and makes cast frequency = cycle frequency.
**Implication:** New `src/agent/farcaster.js`. Neynar API key in secrets. Failure to cast does not fail the cycle — logged but non-blocking.

---

## D-009 — SDK published as `@orbit-house/sdk` on npm

**When:** 2026-05-23
**Session:** S-001
**Decision:** `packages/orbit-sdk` is published to npm under the scope `@orbit-house`. Currently `"private": true` — that flag is removed and the package is published before Phase 1 closes.
**Why:** No external adoption possible without a published package. `@orbit-house` matches the household metaphor and is presumably available (verify before publish).
**Implication:** Owner must register `@orbit-house` org on npm. `create-orbit-repo` is also published under same scope or as a standalone unscoped package.

---

## D-010 — Founder ↔ Orbit voice separation, two accounts

**When:** 2026-05-23
**Session:** S-001
**Decision:** Orbit's Farcaster account is separate from the founder's. Orbit posts about its own work, in first person, terse. Founder posts about the build, the decisions, the broader context, in their own voice.
**Why:** Personification only works if the agent has its own voice. Mixing voices dilutes both. Also reduces the "this is just a founder pumping their thing" reaction.
**Implication:** Two Farcaster accounts maintained. Cast templates in `BRAND.md` govern Orbit's voice. Founder voice has no formal rules — be yourself.

---

## D-011 — ZK trust layer deferred to year 2+; signed-proofs-only at launch

**When:** 2026-05-23
**Session:** S-001
**Decision:** No ZK circuits, provers, or verifiers ship before token launch. The existing roadmap lane `zk-trust` is marked planned-but-not-shipping-soon. Signed proofs (D-006) deliver the trust story for launch.
**Why:** ZK is expensive to build, slow to ship, and narrative-confusing for the launch audience. Plain signed proofs do the same job for the next 12 months. Revisit once token is stable and adoption justifies it.
**Implication:** Roadmap lane ZK Trust Layer remains in `ROADMAP.md` section A but is explicitly year-2+. Phase 5 (S-GATE-4) is the earliest gate at which ZK can be reconsidered.

---

## D-012 — Daily Merkle root anchored on Base in Phase 2

**When:** 2026-05-23
**Session:** S-001
**Decision:** Starting in Phase 2 (post-launch), once per day Orbit computes a Merkle root of all cycle proof hashes from the previous 24 hours and posts it on-chain to a simple registry contract on Base (one tx per day).
**Why:** Cheap (1 tx/day), visceral ("the receipts are on-chain"), and provides a tamper-evident chain — modifying any historical receipt would break the root. Pairs naturally with D-006.
**Implication:** Phase 2 work item (S-015). New contract or use existing on-chain note pattern. Verifier (S-003) extended to also verify against the anchor.

---

## D-013 — Two ladders in the roadmap (GitHub-native + Wallet/Trust); GitHub-native leads

**When:** 2026-05-23
**Session:** S-001
**Decision:** The 11-level roadmap from `memory/roadmap.json` is restructured into two parallel ladders: Ladder A (GitHub-native repo OS) and Ladder B (Wallet & Trust). Ladder A leads in marketing and adoption; Ladder B is the premium upgrade. Both share the same cycle engine.
**Why:** Crypto-heavy positioning is too narrow for adoption. Most repos don't have wallets. GitHub-native positioning broadens TAM and lets crypto be the upgrade tier.
**Implication:** `memory/roadmap.json` needs rewriting in Phase 1 (small task, can be done in S-001 follow-up). Two ladders also reflected in landing copy and dashboard tabs.

---

## D-014 — No on-chain action without an approval issue + signed receipt

**When:** 2026-05-23
**Session:** S-001
**Decision:** Every action that touches the wallet (claim, buyback, refill, token launch, payout-route change) must (a) be preceded by a public approval issue with owner sign-off and (b) produce a signed cycle proof referencing the approval and the tx hash.
**Why:** This is the core trust contract. Skipping it once destroys the credibility of every receipt ever written. No exceptions for "trial runs" or "tiny amounts."
**Implication:** Already partially enforced in `governance.js`. Phase 1 work tightens it to apply to *every* tx-emitting action, with no fallback path.

---

## D-015 — Use ClankerHookStaticFee with asymmetric fees at launch (SUPERSEDED by D-016)

**When:** 2026-05-23
**Session:** S-001
**Decision:** Launch with `ClankerHookStaticFee`: 1% on buys (paired → orbit), 2% on sells (orbit → paired). Optionally enable v4.1 anti-sniper if shipped by Clanker before our launch date.
**Why:** Asymmetric captures more from dumpers (the recipient cohort) than from buyers (the appreciation cohort). Static is legible to users.
**Implication:** Config locked in `CLANKER_FEE_STRATEGY.md`. Change after launch requires D-XXX.
**Superseded:** Owner overrode to symmetric 1%/1% — see D-016.

---

## D-016 — SUPERSEDES D-015 — Symmetric 1%/1% static fees at launch

**When:** 2026-05-23
**Session:** S-001 (correction)
**Decision:** Launch with `ClankerHookStaticFee`: 1.00% on buys AND 1.00% on sells. `clankerFee: 100, pairedFee: 100`.
**Why:** Owner directive. Symmetric is legible, doesn't read as predatory, matches Uniswap-default user expectation. Cleaner narrative for the cast: "1% trading fee, 76% to Orbit's treasury."
**Implication:** `CLANKER_FEE_STRATEGY.md` updated. Sniper protection via v4.1 if available remains optional.

---

## D-017 — SUPERSEDES D-002 — Simplified 2-recipient allocation: 95% Treasury / 5% Operator weekly

**When:** 2026-05-23
**Session:** S-001 (correction)
**Decision:** Two recipients only:
- Treasury Safe: 9500 bps of creator share (76% of total fees), rewards in `Paired` (WETH)
- Operator (founder): 500 bps of creator share (4% of total fees), rewards in `Paired` (WETH), weekly claim cadence

Both recipients have `admin = Treasury Safe`. Buyback, bounty payouts, and lore funding all happen as sub-budgets inside the Treasury Safe under approval flow — NOT pre-routed at the contract level.

**Why:** Owner directive. Simpler operational model: one treasury holds all WETH; all spending decisions are operational (approval-gated), not contract-level pre-allocations. Less surface to defend, cleaner narrative, easier to communicate, fewer wallets to manage. Existing `claimIntervalDays: 7` in `treasury.json` and `run_revenue_cycle` tool already implement weekly operator cadence with no code change.

**Implication:**
- `CLANKER_FEE_STRATEGY.md` updated.
- No separate Buyback / Bounty / Lore wallets needed at launch — these become approval-gated treasury sub-budgets in Phase 2+.
- `DEPLOY_PLAN.md` env var list trimmed (removes `ORBIT_BUYBACK_WALLET`, `ORBIT_BOUNTY_POOL_ADDRESS`, `ORBIT_LORE_POOL_ADDRESS`).
- Operator can't change their own recipient address — re-routing requires Safe multisig vote. Additional rug-pull resistance.

**Supersedes:** D-002 (which prescribed 5 recipients across multiple denominations). D-002's hard rule that all recipients accrue in `Paired` (WETH) is preserved and reinforced.

---

## D-018 — Token launch is hard-blocked until the existing build runs cleanly

**When:** 2026-05-23
**Session:** S-001 (correction)
**Decision:** **The Clanker token launch (`ORBIT_ENABLE_TOKEN_LAUNCH=true`, `npm run cycle` calling `launch_native_token`) is forbidden until ALL of the following are true:**

1. `npm run health` passes with 0 FAIL items and 0 OPEN BLOCKERS in STATUS.md
2. `npm test` passes with 0 failures, 0 skipped tests added in this session
3. AI provider (MiMo Pro 2.5 via OpenGateway) is configured and verified — at least one cycle calls AI successfully and writes a non-fallback proof
4. Cycles fire cleanly via GitHub Actions schedule for 12 unbroken hours (24 cycles × 30 min), every cycle producing a signed proof, with zero crashes and zero deterministic-fallback events
5. Signed cycle proofs (D-006) are live and verifiable via `npx @orbit-house/verifier`
6. Public dashboard at orbit.horse is reachable and shows current cycle data
7. Treasury Safe is deployed and funded on Base
8. Pre-deploy checklist in `CLANKER_FEE_STRATEGY.md` is fully checked

**Why:** Owner directive. Launching a token before the cycle engine is verifiably stable risks the launch credibility story collapsing on day 1. The cycle IS the product — if it doesn't run cleanly, there is no product to back the token. A failed cycle on launch day is a worst-case event that tanks the token instantly.

**Implication:**
- `ORBIT_ENABLE_TOKEN_LAUNCH` stays `false` in repo variables until criteria above are met
- A pre-launch verification session (S-GATE-1) MUST sign off on the 12-hour clean run before phase 2 can begin
- Add an automated check in `src/agent/run.js`: if any tool requests `launch_native_token` and `state.preLaunchVerified !== true` in `memory/state.json`, refuse with explicit error before any tx attempt
- The 12-hour clean run window is the proof artifact for this gate. Capture the cycle range (`firstCleanCycle: N`, `lastCleanCycle: N+24`) in `memory/state.json`

**Scope:** This decision overrides D-013's "two ladders" timing — Ladder B (Wallet & Trust) cannot proceed past wallet policy view until the cycle engine has demonstrated the 12-hour clean run.
