# Orbit — Master Plan

## What Orbit Is

Orbit is the control plane for agent memory and infrastructure inside any GitHub repo. Approval gates, signed cycle proofs, and on-chain treasury are built in. Memory lives in `memory/*.json`. Governance lives in approval issues. Treasury lives in a Safe multisig. A 30-minute cron runs the cycle and writes a signed proof anyone can verify. $ORBIT is the share of the operating economy that flows through the treasury.

## What It Solves

Real problems (not narrative):

- **Scam/drain intake** in crypto-adjacent repos — scanner already works
- **AI spend overruns** — budget gates and approval flow already work
- **Audit trail for autonomous work** — cycle proofs already work
- **Repo continuity across maintainer absence** — memory in git already works

The wedge is the scam scanner; the moat is the governance + receipts pattern; the monetization is the token.

## Positioning

| Audience | One-liner |
|---|---|
| Crypto/Farcaster (launch audience) | *"A repo that runs itself, earns its own keep, and lets you watch every cycle."* |
| Developers (technical audience) | *"GitHub-native agent infrastructure: governance gates, signed receipts, in-repo memory."* |
| Funders/auditors (B2B side path) | *"Mission control for autonomous work — every action gated, signed, and verifiable from outside."* |

The launch leads with the first line. The other two are upgrade paths.

## The Five-Movement Arc

| Phase | When | Goal |
|---|---|---|
| 1. Pre-launch spectacle | Day -28 → Day 0 | Build the visible artifact. Signed proofs, dashboard, casts, lore, second adopter, multisig. |
| 2. Genesis | Launch week | Token live. Cycle N+1 cites the contract in its receipt. Treasury starts capturing WETH from every swap. |
| 3. Sustained activity | Month 1–3 | Daily casts, public approval flow, visible refusals, scams blocked publicly. Closed-loop demo: treasury → AI → cycle. |
| 4. Federation | Month 3–9 | `create-orbit-repo` + SDK on npm + 10–20 adopter repos. Inter-Orbit messaging. Bounty market. |
| 5. Standard | Year 1+ | Other agents read Orbit passports before acting. Spec gets copied. Protocol revenue accrues. |

## What Locks In Sustainability

Three things compounding, all must hit:

1. **Trading-fee flow into treasury in WETH** — see `CLANKER_FEE_STRATEGY.md`. This is the cash floor independent of token price.
2. **Daily visible cycles** — the agent doing things in public is the marketing. If cycles stop, the token dies.
3. **Adoption beyond the genesis repo** — one repo running Orbit is a stunt. Ten is a movement.

## What's Already Built (Don't Rebuild)

| Capability | Where | State |
|---|---|---|
| Wake cycle (30-min cron + event) | `.github/workflows/orbit-cycle.yml`, `.github/workflows/orbit-event.yml` | Working — at cycle #27 |
| Tool registry (40+ tools) | `src/agent/tools.js` | Working — needs plugin loader later |
| Governance / approval loop | `src/agent/governance.js` + `memory/governance.json` | Working — issue + APPROVE comment |
| Treasury budget ledger | `src/agent/treasury.js` + `memory/treasury.json` | Working — needs revenue inflow path |
| Wallet policy (read-only summary) | `src/agent/wallet.js` | Working |
| SDK (read-only) | `packages/orbit-sdk/` | Working — needs npm publish + signing |
| Scam scanner | `packages/issue-scam-scanner/` | Working — already a GitHub Action |
| Cycle proof receipts | `runtime/proofs/` | Working — unsigned, need signing |
| Clanker SDK integration | `clanker-sdk` dep + tools.js entries | Wired — never executed live |
| Multi-direction planner | `src/agent/behavior.js` | Working |

## What Must Be Built Before Launch

In priority order, see `DAY_1.md` and `PHASES.md` for detail:

1. **Wallet-signed cycle proofs** + verifier CLI
2. **Public dashboard** at `orbit.horse` (cycle counter, latest receipt, treasury, last 10 actions)
3. **Farcaster casting** integration in cycle loop
4. **Lore directory** + agent voice guide
5. **`create-orbit-repo` scaffolder** + SDK npm publish
6. **Treasury multisig** (Safe on Base)
7. **One second adopter repo**
8. **Closed-loop self-funding demo** (one public run before launch)
9. **Token launch via Clanker v4** with optimized fee config (see `CLANKER_FEE_STRATEGY.md`)
10. **Genesis cycle** content planned

## What's Deferred (Explicitly Not Day 1)

- ZK trust layer — year 2+
- Smart-account execution — year 2+
- Enterprise compliance tooling — wrong audience
- 40 of the 50 "Frontier Agentics" features — backlog only
- Multi-maintainer quorum — after 5 real adopters
- MCP/HTTP bridge — after federation primitives prove value

## How $ORBIT Captures Value

Two parallel flows:

**Flow A — Trading fees (the floor):**
- 80% of LP fees route to Orbit-controlled recipients (max protocol allows)
- All recipients take fees in **Paired token (WETH)** — survives dumps
- Asymmetric or dynamic fees take more on sells than buys
- Treasury Safe accumulates WETH; visible on Base

**Flow B — Token utility (the ceiling):**
- $ORBIT-denominated bounty market (stake to prioritize work)
- Per-repo subscription paid in $ORBIT (premium tier)
- Inter-Orbit federation micro-fees in $ORBIT
- Plugin/tool registry rev-share in $ORBIT
- Holder utility: priority slot, named-recipient privilege, premium rule packs

Flow A is the survival cash. Flow B is the appreciation thesis. Build A first (Day 1). Build B incrementally (months 1–6).

## Personification (Why The Household Metaphor Stays)

Orbit is a *who*, not a *what*. Identity files (`memory/identity.md`), first-wake intro, cycle counts, survival drivers — these are not internal-only. For a token launch they are *the product*. Cute repo personas pump. Enterprise tone doesn't.

The voice:
- First person, terse, honest, occasionally dry humor
- Posts when it does work (cycle log) and when it refuses (refusal log)
- Apologizes for nothing it didn't actually do
- Treats every owner approval as a public ceremony

See `BRAND.md` for the full voice guide.

## Founder Strategy

Owner is the architect + credential-holder + outside-world interface. Agent is the operations layer.

| Owner does | Agent does |
|---|---|
| Token launch (Clanker v4 deploy) | Daily cycles |
| Multisig setup (Safe on Base) | Issue triage + scam scanning |
| Domain + dashboard hosting | Memory writes |
| Farcaster account + first cast | Receipt writing |
| npm publish (manual) | Tool calls under approval |
| Approval clicks (issue comments) | Approval-issue authoring |
| Lore drafts (with agent's help) | Cycle commits + cast posting |
| Outreach to adopter #2, #3 | Internal task management |

Founder visibility decreases over months 6–12. Agent persona takes over the public face. Narrate the handoff.

## Comp Read

- **gitbank ($2.5M peak):** thin product, narrative-driven, faded post-pump
- **gitlawb ($30M peak):** stronger product fit, sustained activity longer, but eventually tapered
- **$VIRTUAL / aixbt:** different shape (full framework + agent suite), $100M+ — requires more than Orbit alone can do at launch
- **Realistic Orbit ceiling at launch:** $3M–$15M base case; $30M+ requires post-launch execution holding for 90+ days

We optimize for the $30M+ ceiling but plan budget around the $3M floor.

## Hard Rules

1. **No fee recipient takes rewards in $ORBIT.** All recipients accrue in WETH/Paired. Locked. See `DECISIONS.md` D-002.
2. **Treasury is a Safe multisig before token deploys.** No EOA holding treasury at launch.
3. **Cycle proofs must be signed before launch.** Without signatures, the receipt story is fragile.
4. **Cycle cadence must be unbroken for 14 days before launch.** Visible reliability earns trust.
5. **No on-chain action without approval issue + signed receipt.** No exceptions for "trial runs."
6. **Domain orbit.horse hosts the public read-only artifact.** Never a wallet UI, never key material.

## Reading Map

- For the *vision* — this file + `MASTER_PLAN.md`
- For the *fee mechanics* — `CLANKER_FEE_STRATEGY.md`
- For *what to ship first* — `DAY_1.md`
- For *what comes next* — `PHASES.md`
- For *beyond founder-fade* — `FOREVER_ROADMAP.md`
- For *everything else* — `ROADMAP.md`
- For *infrastructure setup* — `DEPLOY_PLAN.md`
- For *voice and lore* — `BRAND.md`
- For *what's locked* — `DECISIONS.md`
- For *what could go wrong* — `RISKS.md`
