# Orbit Roadmap — Unlimited Exploration

> Per the brief: "no limits of exploration." This document is the union of everything Orbit could become. Items move from here into `PHASES.md` as they're prioritized.

Items grouped by domain. Not ranked within group — ranking happens at each phase boundary.

---

## A — Trust & Verification Layer

The core defensible artifact: signed, anchored, verifiable proofs of every autonomous action.

- Wallet-signed cycle proofs (Phase 1)
- Standalone verifier CLI (Phase 1)
- Daily Merkle root anchored on Base (Phase 2)
- Per-cycle receipt anchored on git-notes (no working-tree pollution)
- ENS-resolved passport (`orbit.<repo>.eth`)
- IPFS-pinned proof bundle per cycle
- Tamper-detect alerter (if any historical proof's signature fails verification, file public issue)
- Receipt search engine (full-text + filter by trigger / outcome / risk flag)
- "Replay this cycle" — given a receipt, reconstruct the exact decision tree
- Signed memory snapshots as publishable artifacts
- Cross-repo signed memory federation (read another orbit's signed memory)
- ZK policy receipts (year 2)
- ZK reserve attestation (year 2)
- ZK approved-wallet-set proof (year 2)
- Constitutional commit (any change to policy files requires multi-sig signed commit)
- "Refusal of the week" curated public archive
- Audit pack export (SOC2-ish bundle from cycle proofs)

## B — Governance Primitives

The approval-loop pattern, extended to richer multi-party governance.

- Single-owner approval (current)
- Co-maintainer quorum (M-of-N approval)
- Reviewer role (read receipts + comment but not approve)
- Approval session keys (pre-authorize a class of spend for N hours)
- Approval expiry (auto-reject after N days)
- Delegated approval (timeboxed with revoke trail)
- Recipient address book (named, verification status, trust score)
- Spending velocity limits (max $X per cycle, max Y txns per day)
- Stablecoin-only mode (refuse non-stable token movement)
- Refund flow (incoming funds: ignore, return, or quarantine)
- Emergency brake (one issue/label pauses all autonomy)
- Policy templates (DAO / OSS / agent-shipping / personal — preset policy packs)
- Approval via on-chain multisig sig (alt to issue comment, for Safe-using DAOs)
- Approval via Farcaster cast (alt for mobile approvers)
- Constitutional amendments process (changes to policy files via formal approval)
- Reaction-based light approval (👍 from owner = approve low-stakes spend)
- Approval ladder (low spend = label; med = comment; high = on-chain sig)
- Reputation-gated approval relaxation (proven contributors get streamlined approval)

## C — Treasury & Wallet

Where the money is, what protects it, what makes it grow.

- Safe multisig as treasury (Phase 1)
- WETH-denominated fee capture (Phase 1, locked decision)
- Weekly buyback with approval gate (Phase 2)
- Treasury productive deployment — Aerodrome LP (Phase 3)
- Treasury productive deployment — Moonwell lending (Phase 3)
- Treasury productive deployment — Lido / restaking (year 1+)
- Smart-account session keys (year 2 — risk review required)
- Spend caps enforced at chain level, not just policy (year 1)
- Asset whitelist + blocklist
- Stablecoin reserve floor (X% must remain in stables)
- Treasury simulation lab (run any spend through a simulator before approval)
- Public treasury dashboard with hourly P&L
- Tax-receipt export for treasury (for funded projects' compliance)
- Slashing protocol — if Orbit makes a mistake costing treasury, founder share takes the hit first
- Insurance pool (small % of fees to a reserve for incident response)
- Founder vesting (operator share streams over time, not lump)
- Public address book linking treasury → buyback → operator → bounty pool
- Treasury productivity report (weekly cycle proof includes treasury growth)

## D — Token Utility

Why $ORBIT does something besides go up.

- Bounty market (stake $ORBIT to prioritize issues) (Phase 3)
- Per-repo subscription tier (premium features for paid repos) (Phase 3)
- Inter-Orbit federation micro-fees (Phase 3)
- Plugin economy rev-share (Phase 3)
- Holder utility — priority slot in cycle queue
- Holder utility — named-recipient privilege in approval flows
- Holder utility — premium scanner rule packs
- Holder utility — early access to new tools
- Holder utility — vote weight on capability additions
- Public mission board with staking (anyone can propose work; stake to prioritize; if shipped, proposer earns)
- Token-gated discord/Telegram (top X holders)
- Token-gated "what Orbit's thinking" briefings
- Token-gated capability tier (some tools only available to repos that hold $ORBIT)
- $ORBIT as bounty currency (denominate all bounties in $ORBIT)
- $ORBIT for cross-orbit referrals (one orbit pays another in $ORBIT to refer work)
- Burn-on-use (some actions burn small amounts of $ORBIT; deflation)
- LP rewards (provide $ORBIT/WETH liquidity → earn from fee share — beyond just LP fees)
- Veta-token model (lock $ORBIT for boosted privileges)

## E — GitHub-Native Primitives (Underused Today)

GitHub has primitives Orbit barely touches.

- Discussions API (Q&A + RFC surface)
- Pinned Issues (auto-pin active approvals)
- Issue Templates + Saved Replies (Orbit-authored)
- Reactions (👍 for light approval)
- Pull Requests (draft PRs from agent, not just file writes)
- Check Runs (orbit:risks check on every PR)
- Branch Protection (orbit-controlled rules)
- Merge Queue management
- Stacked PR awareness
- Security Advisories API integration
- Dependabot alert auto-response
- Code Scanning alert response
- Secret Scanning + rotation flow
- Push Protection integration
- Releases API (Orbit publishes drafts from cycle proofs)
- GitHub Pages (per-repo orbit dashboard host)
- GitHub Packages (publish SDK here too)
- GitHub Marketplace (list Orbit Action + scanner)
- GitHub App (proper installation, not PAT)
- CODEOWNERS-driven approval routing
- FUNDING.yml (Orbit treasury as funding source)
- Teams API (multi-maintainer maps to GitHub teams)
- Projects V2 GraphQL (Orbit tasks become a GitHub Project)
- Milestones (orbit phases = GitHub milestones)
- Webhooks (sub-second wake on events)
- Insights / Traffic API (Orbit sees its own popularity)
- Stars / Watchers / Forks events as adoption signals
- Repo custom properties (orbit metadata queryable across orgs)
- Workflow run history (Orbit reads its own CI cost)

## F — Security Operations Lane

The other half of the trust story — defending against external attacks.

- Scam scanner on issues (current)
- Scam scanner rule packs (`@orbit/scam-rules-*` plugins)
- CVE response autopilot (read advisory → file task → propose PR → gate via approval)
- Secret rotation flow (detect leaked secret → file urgent approval → rotate)
- Dependency update gating (Dependabot PR + orbit risk score + approval)
- SAST review (run static analysis, flag high-risk diffs)
- Code-owner-routed review (orbit assigns reviewers per CODEOWNERS)
- Drain pattern library (cross-repo aggregated attack patterns)
- Honeypot issue mode (suspected scam → mark as honeypot, observe, share intel)
- Supply chain anomaly detector (unusual dep version, missing checksum)
- License conflict gate (auto-detect incompatible license additions)
- Snapshot diff alerter (memory file unexpected diff → flag)
- "Stop and call human" mode (panic button, owner-toggled)
- Incident response runbook (template + auto-fill when incident triggered)
- Phishing-link defender (URLs in issues checked against threat feeds)

## G — Release & Developer Workflow

Reduce maintainer toil.

- Docs Truth Auditor (README/code drift detection)
- Test Gap Cartographer (find untested code paths)
- Dependency Update Planner (batched, risk-scored)
- CI Repair Planner (failing pipeline → proposed minimal fix)
- Screenshot Regression Triage (frontend visual diff alerts)
- Release Commander (draft changelog from cycle proofs)
- API Drift Watchtower (breaking change detection)
- Architecture Debt Ledger (complexity drift over time)
- Cost Of Change Estimator (predict CI/AI cost of a proposed change)
- Workflow Surgeon (refactor Actions workflows for cost)
- CI Time Trader (find slow jobs, propose parallelization)
- Flake Court (quarantine flaky tests)
- Bug Reproduction Factory (auto-generate repro from bug reports)
- Duplicate Issue Fuser (merge dup intake)
- README Market Maker (suggest README improvements based on repo activity)
- Maintainer Inbox Zero (daily digest of what needs human attention)
- Project Momentum Engine (visible "this week's velocity" reports)
- Stale PR Closer (with grace period and notification)
- Branch Sprawl Trimmer (auto-archive abandoned branches)
- Contributor Recognition (auto-credit, badges, leaderboard)
- License Conflict Referee
- Roadmap Reality Checker (current roadmap vs. shipped reality)

## H — Federation & Inter-Orbit

Multiple Orbit-powered repos talking to each other.

- HELLO message (basic handshake) (Phase 3)
- CAPABILITY_ADVERTISE (broadcast "I can do X") (Phase 3)
- INTEL_SHARE (cross-repo scam blocklist, malicious addresses) (Phase 3)
- BOUNTY_REFERRAL (orbit A refers a bounty to orbit B for a cut) (Phase 3)
- PASSPORT_REQUEST (read another orbit's passport) (Phase 3)
- MEMORY_FEDERATION (read selected public memory from another orbit)
- TRADE_TASKS (one orbit can offer/request tasks to another)
- CROSS_ORBIT_REVIEW (orbit A reviews orbit B's PR)
- COLONY_TASK_MARKET (priced tasks claimable across orbits)
- AGENT_LINEAGE_LEDGER (which orbit created/configured/delegated which)
- ORBIT_OF_ORBITS — one dashboard across N orbits
- CROSS_ORBIT_TREATIES (formal cooperation agreements between orbits)
- SHARED_RULE_PACKS (one orbit's scam rules deployed to many)
- FEDERATED_BOUNTY_BOARD (all orbits' bounties in one place)
- SLASHING_PROTOCOL (federated reputation; bad orbits lose access)
- ORBIT_REGISTRY (public directory, signed-attestation badge for verified orbits)

## I — Agent Identity & Capabilities

Orbit's "passport" as a portable, verifiable identity.

- Agent passport (current — basic JSON via SDK)
- Signed passport (Phase 2)
- ENS-resolved passport
- Capability registry (current — features.js)
- Capability lease (timeboxed grant of specific power)
- Capability revocation (public revoke event)
- Reputation trail (completed work, refused unsafe actions, rollback history)
- Reputation penalty hooks (failed/reverted actions reduce autonomy)
- Trust ladder (graduated autonomy based on history)
- Verifiable credentials style (W3C VC)
- Onchain identity resolver (orbit name → wallet → repo → contract)
- Handoff packet (transferable orbit identity to a new repo)
- Child agent spawning (with charter, budget, shutdown rule)
- Child agent quorum (multiple signals before child acts)
- Mission DNA file (durable purpose + boundaries)
- Verifiable sleep cycle (record why orbit stopped)
- Vital signs (health, budget, stale queues as agent vitals)
- Public mission board (active missions, blocked decisions, budgets)
- Agent contract registry (which contracts orbit uses + trust levels)
- Protocol adapter layer (replaceable Base/Clanker/GitHub/AI integrations)

## J — Tools & Plugin Economy

The contributor surface.

- Plugin loader for `@orbit/tool-*` (Phase 3)
- Tool risk classifier (each plugin declares risk level)
- Tool sandbox (worker process with allowlist)
- Tool reputation (cross-repo aggregate stats)
- Tool registry website
- Tool version pinning
- Tool fee mechanism ($ORBIT cut on use)
- Plugin marketplace
- Rule pack ecosystem for scanner (`@orbit/scam-rules-*`)
- Capability bundles (preset stacks for DAO ops / OSS maintainer / token launch)
- Tool changelog auto-generator
- Tool deprecation flow

## K — Surface / UX / Distribution

How users find and use Orbit.

- Public dashboard at orbit.horse (Phase 1)
- `create-orbit-repo` scaffolder (Phase 1)
- npm-published SDK (Phase 1)
- README badge (`[Orbit · cycle #N · last receipt ✓]`)
- Marketplace listing (GitHub Marketplace for scanner)
- Per-orbit github.io dashboard (host SDK output bundle)
- Embed widget (iframe orbit status anywhere)
- ChatOps mirror (Slack/Discord bot reflecting GitHub approval flow)
- Mobile approval card (signed magic-link URL for owner phone approval)
- Push notification adapter (Telegram/Discord/Slack)
- Farcaster Frame for orbit status (interactive cast)
- iOS/Android push for approval requests
- Cycle replay viewer (walk through a real cycle step by step)
- Failure museum (anonymized record of agent mistakes for learning)
- Adoption diff (compare a live orbit against the canonical template)
- Migration kit (`orbit ingest` for non-orbit repos)
- Two-skin dashboard (operator skin + household skin)
- Public Q&A interface (visitors ask, orbit answers from memory)

## L — Content / Lore / Community

Culture is infrastructure.

- Lore directory (Phase 1)
- Genesis manifesto (Phase 1)
- Voice guide (Phase 1)
- Daily Farcaster cast (Phase 1)
- Weekly "letter from Orbit" (Phase 2)
- Monthly "what I learned" memo (Phase 2)
- Anniversary cycles (year markers)
- Milestone cycle markers (cycle #100, #1000, etc.)
- Refusal of the week (curated)
- Approval drama log (visible approval flow as theater)
- Orbit's reading list (public list of papers, repos, posts Orbit refers to)
- Cross-orbit conversations (visible inter-orbit messages as content)
- Orbit founders public (transparent founder presence/withdrawal arc)
- Cult/community membership artifacts (member-only lore)
- Inside jokes file (yes, intentionally — culture)
- Orbit's birthday + obituary template (in case it ever dies, this is how)
- Public learning failures (acknowledged mistakes with what was learned)
- "What Orbit would have done" — alternate-history cycles for what-if
- Founder gradually steps back (narrated publicly over months)

## M — Income Beyond Trading Fees

Diversify the revenue base.

- Per-repo subscription paid in $ORBIT (Phase 3)
- $ORBIT bounty market fee cuts (Phase 3)
- Federation message micro-fees (Phase 3)
- Plugin economy revenue share (Phase 3)
- Premium passport verification service
- Audit pack export as paid service
- Hosted Orbit (managed instance for SMBs)
- Consulting / integration services (founder time-bound)
- Marketplace SKU manifest (Orbit offers services for $)
- Sponsorship adapter (GitHub Sponsors, Open Collective, Drips)
- Paid issue routing (priority triage for sponsors)
- Tip jar (label-driven invoice flow)
- Verified-orbit badge as paid service
- Grant funder accountability portal (paid by funders, not repos)
- Insurance product (cover incident losses for premium repos)
- Treasury productive yield (LP, lending, restaking)
- Buyback-and-burn programmatic flywheel

## N — Compliance / Enterprise (When Ready)

The B2B upgrade path; year 2+.

- SOC2-style audit pack export
- ISO27001 evidence collection
- GDPR right-to-erase flow
- Data retention policy (auto-archive cycles > N months)
- Legal-hold mode (freeze memory mutations)
- PII detector in agent outputs
- Tenancy isolation (multi-tenant orbit)
- Role-based access control
- Audit log immutability proof
- Regulatory readiness checklist
- Per-jurisdiction policy adapters
- KYC/AML adapter for treasury (when required)
- Tax-reporting export
- Insurance integrations

## O — Advanced / Frontier / Year 2+

Long-term exploration; nothing is ruled out.

- ZK Trust Layer (full circuits, prover, on-chain verifier)
- ZK policy attestation
- ZK reserve floor proof
- Smart-account execution (ERC-4337)
- Session keys with revocation
- Guardian recovery
- Spend caps at contract level
- Cross-chain orbit (Base + Ethereum + Solana?)
- TLSNotary-style data provenance (zkTLS for off-chain receipts)
- Orbit-spawned sub-projects (Orbit founds repos itself)
- Orbit-as-DAO (governance migrates to token holders)
- Orbit operates other agents (Sweep/OpenHands as Orbit's tools)
- Treasury Autopilot Sandbox (simulate before live)
- Self-improvement protocol (Orbit proposes changes to its own code via PR)
- Constitutional amendments via on-chain governance
- Cross-protocol bounty referrals (Gitcoin, Drips, Open Collective)
- Reputation-based DAO membership (high-rep orbits get protocol voice)
- Inter-orbit task auctions (anyone can bid to do work)
- Federated learning across orbits (shared improvements)
- Orbit-spec as RFC (formal standardization process)
- Multiple competing orbit implementations (different repos run different agents speaking the spec)
- Public mission proposals (anyone proposes, $ORBIT prioritizes)
- "Verifiable autonomous corporation" framing (Orbit as a legal entity in friendly jurisdiction)
- Endowment model (treasury funds projects, not just Orbit ops)

---

## How This Document Is Used

- **At each S-GATE-N session**, this roadmap is reviewed
- Items get promoted into the next phase based on:
  - What the launch needs to survive (Phase 2)
  - What adoption needs to compound (Phase 3)
  - What standardization needs (Phase 4)
- New items get added freely as ideas emerge
- Items don't get deleted — they get marked `dropped` with reasoning if no longer relevant
- The roadmap is intentionally bigger than what will ship — abundance forces prioritization

## Editing Rules

- Anyone can propose an addition via PR
- Removal requires owner approval + reason in commit message
- Promotion to a phase requires consensus that prereqs are met
- Items reference their source (a learning, a comp, a research finding, a customer request)
