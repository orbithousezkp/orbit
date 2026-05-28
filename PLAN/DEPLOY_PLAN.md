# Orbit — Deploy Plan

> Living document. Updated every session that introduces a deploy-relevant change.

> **Status note (2026-05-28):** The `orbit.horse` custom-domain plan referenced
> throughout this document is **deferred**. Current Pages target is the
> repo's default subdomain `https://orbithousezkp.github.io/orbit/`. The
> `orbit.horse` content below is retained as future-option scaffolding —
> ignore the DNS / CNAME / "Domain Configuration" sections until/unless a
> custom domain is re-added. See commit 84767747 (drop orbit.horse stub)
> + `PLAN/OWNER_PUNCH_LIST.md` §1 (live Pages setup).

## Architecture Overview

```
[orbithousezkp.github.io/orbit]   — public dashboard (read-only, default Pages URL)
       │
       └──> GitHub Pages — static site (built by .github/workflows/deploy-dashboard.yml)
                │
                └──> Reads from public-orbit-repo (this repo)
                                │
                                └──> .github/workflows/orbit-cycle.yml  (30-min cron)
                                └──> .github/workflows/orbit-event.yml  (issue/comment events)
                                            │
                                            └──> npm run cycle
                                                       │
                                                       ├──> Reads memory/*.json
                                                       ├──> Calls AI provider (private route)
                                                       ├──> Executes tools (under governance)
                                                       ├──> Writes signed proof to runtime/proofs/
                                                       ├──> Casts to Farcaster (Neynar API)
                                                       └──> Commits + pushes

[Base mainnet]
       │
       ├──> $ORBIT token contract (Clanker v4)
       ├──> ClankerFeeLocker (collects LP fees)
       ├──> Recipients:
       │      ├──> Treasury Safe (50% WETH)
       │      ├──> Buyback Wallet (15% WETH)
       │      ├──> Operator (5% WETH)
       │      ├──> Bounty Pool (7% Both)
       │      └──> Lore Pool (3% WETH)
       └──> Merkle anchor contract (Phase 2, daily root)

[Farcaster]
       │
       ├──> @orbit account (cycle posts, refusals, approvals)
       └──> @founder account (build commentary)
```

## Domain Configuration

**Current target:** Pages default URL `https://orbithousezkp.github.io/orbit/`. No custom domain.

| Domain | Use | Status |
|---|---|---|
| `orbithousezkp.github.io/orbit/` | Public read-only dashboard (current default) | Awaits Pages enable — see `PLAN/OWNER_PUNCH_LIST.md` §1 |
| ~~`orbit.horse`~~ | (deferred — owned but not wired) | Deferred per commit 84767747. The DNS setup steps below remain as a runbook for future re-enable, not as a Phase 1 task. |
| `verify.<custom>` (optional) | Hosted receipt verifier UI | Phase 2+ — let anyone paste a proof and verify |
| `api.<custom>` (optional) | HTTP read API mirroring the SDK | Phase 4 — wait for federation demand |

DNS setup steps (only when custom domain is re-enabled — deferred):
1. At registrar: four `A` records on apex `<your-domain>` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
2. Repo → Settings → Pages → Source: **GitHub Actions**, custom domain `<your-domain>`, Enforce HTTPS once cert provisions
3. Verify with `dig <your-domain>` and `curl -I https://<your-domain>`

## Third-Party Accounts Needed

| Service | Purpose | Owner action |
|---|---|---|
| GitHub Org `orbit-house` (or equivalent) | Repo, packages, marketplace | Verify ownership |
| npm `@orbit-house` scope | SDK publication | Create org, add publish token to GitHub secrets |
| Neynar API account | Farcaster casting | Sign up, get API key + signer, add to repo secrets |
| Farcaster account `@orbit` | Orbit's public voice | Create, link signer to Neynar |
| GitHub Pages | Dashboard hosting | Repo Settings → Pages → Source: GitHub Actions. Default URL `https://orbithousezkp.github.io/orbit/`; custom domain deferred. |
| Safe multisig | Treasury custody | Deploy on Base, add signers |
| Clanker.world | Token launch | Connect deployer wallet at launch time |
| Base RPC (Alchemy/QuickNode) | On-chain reads from cycle | API key in secrets |
| AI provider (private) | Inference routes | Existing — already configured |
| Email/Discord bot (optional) | Notification mirror | Phase 2 |

## Environment Variable Inventory

### Already in `.github/workflows/orbit-cycle.yml`

| Var | Set by | Where stored | Purpose |
|---|---|---|---|
| `ORBIT_AI_PROVIDERS` | Owner | GitHub Secret | JSON route list for AI |
| `ORBIT_AI_PROVIDER_KEYS` | Owner | GitHub Secret | AI provider keys |
| `ORBIT_AI_DAILY_BUDGET_USD` | Owner | GitHub Variable | Daily AI cap |
| `ORBIT_AI_MONTHLY_BUDGET_USD` | Owner | GitHub Variable | Monthly AI cap |
| `GITHUB_TOKEN` | GitHub | Auto | Repo write |
| `GITHUB_REPOSITORY` | GitHub | Auto | Self-reference |
| `ORBIT_OWNER_USERNAME` | Owner | GitHub Variable | Approval comment author check |
| `ORBIT_APPROVAL_ISSUE_LABEL` | Owner | GitHub Variable | Default `orbit:approval` |
| `ORBIT_APPROVAL_ACCEPTED_LABEL` | Owner | GitHub Variable | Default `orbit:approved` |
| `ORBIT_APPROVAL_REJECTED_LABEL` | Owner | GitHub Variable | Default `orbit:rejected` |
| `ORBIT_DRY_RUN` | Owner | GitHub Variable | `false` post-launch |
| `ORBIT_COMMIT_CHANGES` | Owner | GitHub Variable | `true` post-launch |
| `ORBIT_PUSH_CHANGES` | Owner | GitHub Variable | `true` post-launch |
| `ORBIT_ALLOW_COMMANDS` | Owner | GitHub Variable | `false` — keep off |
| `ORBIT_TOKEN_ADMIN_ADDRESS` | Owner | GitHub Secret | Token admin (Safe) |
| `ORBIT_TREASURY_ADDRESS` | Owner | GitHub Secret | Treasury Safe |
| `ORBIT_OPERATOR_REVENUE_ADDRESS` | Owner | GitHub Secret | Operator share recipient |
| `ORBIT_OPERATOR_REVENUE_BPS` | Owner | GitHub Secret | Op share bps |
| `ORBIT_BASE_RPC_URL` | Owner | GitHub Secret | Base RPC endpoint |
| `ORBIT_WALLET_PRIVATE_KEY` | Owner | GitHub Secret | **Agent signing key** — for proof signatures + on-chain claims |
| `ORBIT_ENABLE_TOKEN_LAUNCH` | Owner | GitHub Variable | `true` only for launch session |
| `ORBIT_ENABLE_REVENUE_CLAIMS` | Owner | GitHub Variable | `true` post-launch |

### New vars needed for Phase 1

| Var | Purpose |
|---|---|
| `ORBIT_AGENT_SIGNER` | Public address of the signing key — what verifiers expect |
| `ORBIT_FARCASTER_NEYNAR_API_KEY` | Neynar API access |
| `ORBIT_FARCASTER_SIGNER_UUID` | Neynar signer for the @orbit account |
| `ORBIT_DASHBOARD_URL` | `https://orbithousezkp.github.io/orbit/` — for cast links (custom domain deferred) |
| `ORBIT_VERIFIER_NPM_PACKAGE` | `@orbit-house/verifier` — for instructions in casts |

(Per D-017: Buyback/Bounty/Lore wallets removed. All WETH flows to Treasury Safe; spending happens via approval-gated sub-budgets.)

### New vars needed for Phase 2 (post-launch)

| Var | Purpose |
|---|---|
| `ORBIT_TOKEN_ADDRESS` | $ORBIT contract address (filled in after deploy) |
| `ORBIT_MERKLE_ANCHOR_CONTRACT` | Daily Merkle root anchor contract on Base |
| `ORBIT_BUYBACK_ROUTER` | DEX router for buybacks (Uniswap V4 router on Base) |
| `ORBIT_PAIRED_TOKEN_ADDRESS` | WETH on Base (`0x4200000000000000000000000000000000000006`) |

## Infrastructure Components

| Component | Status | Owner action |
|---|---|---|
| GitHub Actions runner | Working | None |
| Memory file storage (git) | Working | None |
| Cycle proof storage | Working | None — Phase 1 adds signing |
| AI provider routing | Working | None |
| Base RPC | Configured | Verify key still valid |
| Treasury Safe | Not yet | Phase 1 — deploy + add signers |
| Buyback wallet | Not yet | Phase 1 — derive/deploy |
| Bounty pool wallet | Not yet | Phase 1 — derive/deploy (can defer until Phase 3 if no bounties yet) |
| Lore pool wallet | Not yet | Phase 1 — derive (small balance is fine) |
| Farcaster signer (Neynar) | Not yet | Phase 1 — sign up + onboard |
| Dashboard hosting | Shipped — GitHub Pages workflow + CNAME | Phase 1 — owner enables Pages in repo Settings |
| npm `@orbit-house` org | Not yet | Phase 1 — register, get publish token |
| Merkle anchor contract | Not yet | Phase 2 — write simple contract or use existing pattern |

## Automated vs Manual Steps

### Fully automated (per-cycle, no human touch)

- Cycle execution
- Memory updates
- Tool calls under governance
- Receipt signing + writing
- Farcaster casts (once configured)
- Commit + push
- Cycle proof addition

### Owner-gated (one-time setup)

- Treasury Safe deploy + signer add
- Recipient wallet derivation
- Farcaster account creation
- DNS configuration (only if a custom domain is re-introduced; deferred)
- npm org registration + publish
- Token deploy via clanker.world
- AI provider top-up (when approval issue fires)
- Approval issue acceptance (per high-stakes action)

### Owner-gated (recurring)

- Weekly buyback approval (Phase 2+)
- Phase-gate sign-off (every S-GATE)
- Lore writing (with agent drafts)
- Outreach to new adopter repos
- Cast template review (monthly check)

## Deploy Script (Generated Later)

Per the protocol, the deploy script is generated at the final S-REVIEW (Phase 1) with owner confirmation. It will:

1. Verify all env vars set
2. Verify all addresses resolve
3. Verify SDK npm package publishable
4. Verify dashboard build succeeds
5. Trigger deploy of dashboard
6. Trigger publish of SDK + scaffolder + verifier
7. Confirm cycle runs successfully post-deploy

Owner runs the script manually. Not auto-executed.

## Wallet Section (Required by Protocol)

| Wallet | Type | Address | Funding | Purpose |
|---|---|---|---|---|
| Agent Signer | EOA | `0x[from ORBIT_WALLET_PRIVATE_KEY]` | ~0.05 ETH for gas | Signs proofs, claims rewards, executes approved tx |
| Treasury Safe | Safe 2-of-3 | `0x[deploy on Base]` | 0.1 ETH initial | Custody of WETH fees (95% of creator share). Funds buybacks, bounties, lore, ops via approval-gated sub-budgets |
| Operator | EOA | `0x[founder address]` | 0 ETH initial | Founder share (5% of creator share, weekly cadence). Admin controlled by Treasury Safe — cannot self-rotate. |
| Clanker Deployer | EOA | `0x[hot wallet for clanker.world UI]` | ~0.01 ETH initial | Burner wallet used only to sign the Clanker deploy tx. Admin powers transfer to Treasury Safe immediately. |

**Hard rule:** No wallet address in source control. All addresses live in GitHub Secrets and are referenced by env var name only.

## Domain — Custom domain (deferred)

> Current target is the Pages default URL `https://orbithousezkp.github.io/orbit/` — no DNS work required. The steps below are the runbook for re-introducing a custom domain (e.g. if `orbit.horse` is re-enabled later). Do not execute as part of S-GATE-1.

Setup (GitHub Pages only — see `feedback_github_only` memory):

1. Repo → Settings → Pages → Source: **GitHub Actions** (the `.github/workflows/deploy-dashboard.yml` workflow handles build + deploy)
2. Repo → Settings → Pages → Custom domain: `<your-domain>` (add a `public/CNAME` file declaring it)
3. At registrar, add four `A` records on apex pointing to GitHub Pages IPs:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
4. Optional: `CNAME` record on `www` → `<owner>.github.io.`
5. Wait for HTTPS cert provisioning (usually <10 min), then tick "Enforce HTTPS"
6. Verify `dig <your-domain> +short` returns the four IPs above and `curl -I https://<your-domain>` returns 200
7. Every cycle commit will trigger a Pages redeploy via the workflow's `paths:` filter

No third-party hosting. No deploy hook. No external CI.

## Change Log

| Date | Session | What changed |
|---|---|---|
| 2026-05-23 | S-001 | Initial deploy plan created. Custom domain (orbit.horse), Safe treasury, Clanker fee config locked. |
| 2026-05-28 | S-OWNER-RUNBOOK | Dropped orbit.horse from active plan (commit 84767747). Default Pages URL `orbithousezkp.github.io/orbit/`. Custom-domain section reframed as a future runbook. Added `OWNER_PUNCH_LIST.md` cross-ref. |
| 2026-05-24 | S-003 | Dashboard hosting locked to GitHub Pages per "github-only" constraint. Vercel references removed. `deploy-dashboard.yml` + `public/CNAME` shipped. |
