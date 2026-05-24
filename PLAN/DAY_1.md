# Day 1 — What Ships First

> "Day 1" here means the first session of focused work to convert today's state into a launchable product. Realistically a 1–2 day burst, not a calendar 24h.

## Ship-Now List (Day 1 — 8 items)

Everything below is implementable with what exists today. No new dependencies, no new architecture.

### 1. Wallet-Signed Cycle Proofs

**Why first:** This is the single biggest credibility unlock. Every other claim about Orbit reduces to "verify the receipt." Without signatures, receipts are JSON. With signatures, they're proofs.

**What:**
- Modify cycle proof writer (likely in `src/agent/run.js` or `src/agent/actions.js`) to sign the JSON payload with `ORBIT_WALLET_PRIVATE_KEY` using viem
- Output: `{ proof: {...}, signature: "0x...", signer: "0x..." }` written to `runtime/proofs/`
- SDK `readReceipts` already computes a hash digest — add signature verification alongside

**Effort:** ~4 hours, owner builds (security-critical, agent shouldn't touch crypto code on itself)

### 2. Standalone Verifier CLI

**What:**
- New file `packages/orbit-verifier/index.js` and `cli.js`
- `npx @orbit-house/verifier <proof.json>` reads proof, recovers signer, checks against expected signer address
- Returns OK / FAIL with cycle ID + signer

**Effort:** ~2 hours

### 3. Orbit-Side Farcaster Caster

**What:**
- Add `cast_to_farcaster` tool to `src/agent/tools.js`
- Implementation in new `src/agent/farcaster.js`: use Neynar API or Hub-direct posting
- At end of every cycle, agent posts: cycle #N, summary, link to receipt
- Owner provides Neynar API key + signer via repo secrets

**Effort:** ~3 hours, owner sets up account

### 4. Public Dashboard at orbit.horse

**What:**
- New static site (Vite build of existing `src/App.jsx` with simplified read-only mode) at `orbit.horse`
- Shows: cycle counter, latest receipt (signed), treasury Safe balance, last 10 actions, blocked-actions list
- Deploys from public repo via GitHub Pages (`.github/workflows/deploy-dashboard.yml`)
- Updates on every push (every cycle)

**Effort:** ~3 hours, mostly DNS + hosting setup

### 5. Lore Directory + Voice Guide

**What:**
- New `lore/` directory in repo
- `lore/00-genesis.md` — "First wake" lore, in Orbit's voice
- `lore/voice.md` — voice guide (see `BRAND.md` for content)
- `lore/cycles-of-note/` — placeholder for milestone cycle notes

**Effort:** ~2 hours owner writing + agent drafting

### 6. SDK npm Publish + create-orbit-repo

**What:**
- Remove `"private": true` from `packages/orbit-sdk/package.json`
- Add LICENSE, README, publish to npm as `@orbit-house/sdk`
- New `packages/create-orbit-repo/` — small bin that scaffolds `.github/workflows/`, `memory/`, `governance.json`, `treasury.json` defaults
- Publish as `create-orbit-repo` so `npx create-orbit-repo` works

**Effort:** ~3 hours

### 7. Treasury Safe on Base + Recipient Wallets

**What (owner-only, off-repo):**
- Deploy Safe multisig on Base (use Safe UI)
- Add 2-3 signers, threshold 2-of-3
- Derive/deploy 4 additional recipient addresses per `CLANKER_FEE_STRATEGY.md` (Buyback, Operator, Bounty Pool, Lore Pool)
- Fund Safe with small ETH for gas
- Record addresses in GitHub secrets matching the names in `.github/workflows/orbit-cycle.yml`

**Effort:** ~1 hour

### 8. Closed-Loop Demo Dry Run

**What:**
- Owner triggers a manual cycle
- Cycle uses `request_ai_food_refill` to test the approval flow
- Owner approves via issue comment
- Cycle records refill via `record_ai_food_refill` with a proof URL
- Receipt links the approval, the refill, and the next AI call
- Cast this on Farcaster as "Orbit's first closed loop"

**Effort:** ~1 hour to run, depends on AI provider top-up flow

---

## Day 2–7 — Stabilization Sprint

After Day 1, run for 7 days of stable cycles before announcing launch date. Goal: zero broken cycles, zero false refusals, zero secrets leaked. If any incident happens, fix and restart the 7-day timer.

### Items shipped during the 7-day stabilization

- **Daily Farcaster casts** — every cycle posts; tune the cast template based on response
- **Second adopter repo** — owner reaches out to one friend, gets them to install Orbit. Their first cycle gets called out.
- **Cast template iteration** — first 3-5 casts will be awkward; revise voice
- **Dashboard polish** — what's missing, what loads slow, what's confusing
- **`memory/strategy.md` rewrite** — update with the actual plan (currently outdated)
- **Approval flow public theater** — manufacture one real approval that everyone watches happen
- **First buyback dry run** — even if treasury has $0 in WETH, run the approval-issue-for-buyback flow once to debug

### Items that should NOT ship in week 1

- Bounty market (Phase 2)
- Federation protocol (Phase 3)
- Plugin loader for tools (Phase 2)
- Multi-maintainer model (later)
- Anything that adds new dependencies the launch story doesn't need

---

## Day 8–14 — Launch Prep

- Token deploy via Clanker v4 (dry run on testnet if possible, otherwise small-allocation mainnet test)
- Lore drops (one new piece per day in `lore/`)
- KOL outreach (5–10 Farcaster accounts to brief pre-launch)
- Genesis cycle staging — what does the post-launch cycle look like?
- Final pre-launch checklist sign-off (see `CLANKER_FEE_STRATEGY.md` Pre-Deploy Checklist)

---

## Day 15 — Launch Day

Specific runbook:

1. **T-2h:** Final check — all signers reachable, gas in deployer wallet, dashboard live, Farcaster account ready
2. **T-1h:** Post "we ship today" cast from Orbit
3. **T-0:** Deploy via clanker.world with config from `CLANKER_FEE_STRATEGY.md`
4. **T+5m:** Verify deploy on Basescan, capture all addresses
5. **T+10m:** Update `memory/treasury.json` with token address, deploy tx, hook address
6. **T+15m:** Commit + push (visible on GitHub)
7. **T+20m:** Trigger a cycle (`workflow_dispatch`). This is the genesis cycle. Its receipt cites the token contract.
8. **T+30m:** Cast: "Orbit just launched. Genesis cycle: <receipt-url>. Treasury: <safe-url>. Contract: <basescan-url>."
9. **T+1h:** Reply to mentions for 2-3 hours. Pin the dashboard.
10. **T+24h:** First full day of post-launch cycles. Cast summary.

---

## What Owner Does vs. Agent Does

| Item | Owner | Agent |
|---|---|---|
| 1. Signed proofs | Implements code | Uses it (writes signed proofs every cycle) |
| 2. Verifier CLI | Implements + publishes | — |
| 3. Farcaster caster | Sets up account + secrets | Posts daily after wiring done |
| 4. Dashboard | Deploys to orbit.horse | — |
| 5. Lore + voice | Drafts, with agent input | Drafts subsequent cycle notes |
| 6. SDK + scaffolder | Publishes to npm | — |
| 7. Treasury Safe | Deploys + funds | — |
| 8. Closed-loop demo | Triggers + approves | Executes the flow |

Owner handles every external-account and code-with-keys task. Agent handles in-repo execution and visible cadence.

---

## Day-1 Success Criteria

End of Day 1, the repo state shows:

- [ ] At least one signed cycle proof exists
- [ ] Verifier CLI runs cleanly on that proof
- [ ] Dashboard live at orbit.horse showing the cycle counter
- [ ] At least one Farcaster cast from Orbit's account
- [ ] `lore/00-genesis.md` exists
- [ ] `@orbit-house/sdk` is published to npm
- [ ] `create-orbit-repo` is published to npm
- [ ] Treasury Safe deployed on Base with all signers
- [ ] One closed-loop demo run end-to-end with public receipt

If any item is incomplete, that's the next session's first work. Don't move to launch prep until all 9 are done.
