# LAUNCH_PLAN.md — Sequenced path to public launch

> One artifact. Every step below is grounded in concrete files in this repo, not invented work. Status reflects the audit completed 2026-05-26 across PLAN/, src/, packages/, memory/, lore/, runtime/, public/, and the dashboard React tree.

The launch path is six numbered steps in order. Skipping ahead breaks the sequence.

---

## Step 1 — Clean every file to public-ready (Patch Set X)

The audit found **5 launch-blocking issues** and **3 high-priority drift fixes**. None require new features. All are corrections.

### 1.1 Critical — dashboard renders broken without these

| # | File | Issue | Action |
|---|---|---|---|
| 1 | `public/dashboard.json` | Missing `handoff` + `errors` slices (the SDK now emits them after Patch S, but the file pre-dates that). Inspect renders cells with "—" and "projection rebuilds next cycle" hints, looking unfinished. | Add a `scripts/regen-dashboard.js` + `npm run dashboard:regen`; run it to refresh `public/dashboard.json`. |
| 2 | `src/sections/Inspect.jsx:63` | `publicViewOnly ? 'public view only · keys gated' : 'public view only · keys gated'` — identical text on both branches. Visible stub. | Replace with proper branching (`'gated · approval-issue required'` vs `'public view only · keys gated'`). |
| 3 | `src/sections/Inspect.jsx:178` | Raw fetch error appended to a public cell hint (`err ? ` · ${err}` : ''`). A network blip leaks `HTTP 503` etc. to visitors. | Show `'data unavailable'` for any error; keep the real error in a console.warn for debugging. |
| 4 | `src/sections/Hero.jsx:10-12` | Tagline drifted: `"the agent memory and infrastructure layer for github repositories"`. BRAND.md canonical is `"the control plane for agent memory and infrastructure inside any GitHub repo"`. | Use the canonical line. |
| 5 | `src/index.css:374, 525` | Mobile horizontal scroll on `.caps` grid and `.roadmap__rail` contradicts the "no scroll" design rule stated at the top of the file. | Constrain to viewport on small screens; rail becomes a row of small dots, caps becomes a stacked list. |

### 1.2 High — docs claim things that aren't true yet

| # | File | Issue | Action |
|---|---|---|---|
| 6 | `PLAN/ADOPTER_QUICKSTART.md:29` | `npx create-orbit-house "$ORBIT_REPO"` is shown as if the package is on npm. It isn't yet (PUBLISHING.md says it's a tag-push away). | Note "(available after Patch O publishes to npm)" or add the clone-and-run alternative. |
| 7 | `PLAN/ADOPTER_PITCH.md:73-81` | Phase table shows 4 phases. PHASES.md is 9 + horizon. | Rewrite the table to match phases.js / PHASES.md. |
| 8 | `README.md` + `memory/identity.md` | Both reference the existing tagline; if 1.4 changes the Hero, make sure the canonical line stays canonical here too. | Keep them in sync. |

### 1.3 Deferred (note here, fix later — not launch-blocking)

- `memory/infrastructure.json:11` + `memory/roadmap.json:4` timestamps are stale (May 23). They regenerate on next cycle — no manual fix.
- `packages/issue-scam-scanner/package.json:20` has `"private": true` — owner must decide public-npm vs GitHub-Action-only.
- `packages/orbit-anchor/` has no Solidity test suite (`test/MerkleAnchor.t.sol`). Not blocking for launch since anchoring is Phase 2 work.
- `packages/orbit-mcp-server` sdk-adapter has a require-fallback that only works in the monorepo. Won't matter until someone installs it from npm.

---

## Step 2 — Build the frontend

After Step 1 lands, the dashboard is a clean baseline. The frontend redesign covers:

1. Design pass on Hero / Live / Roadmap / Inspect / Forever using the `frontend-design` skill.
2. Surface the new machinery cleanly (handoff lifecycle visualization, errors trail, cycle-backoff state, federation outbox count).
3. Typography + motion + section transitions.
4. Mobile-first layouts that genuinely fit each viewport (no scroll, per `index.css:2`).

Out of scope for Step 2: new features. Just the visual layer.

---

## Step 3 — Private-repo dry-run

Per the founder's plan: before public launch, run Orbit live in a **private test repo** for fluency. Memory says this repo is `candyburst/orbit-private-live`.

What we verify:

1. The scheduled cycle fires every 15 min without skipping.
2. Signed proofs land under `runtime/proofs/<date>/` and verify via `npx @orbit-house/verifier`.
3. The dashboard rebuilds with real data after each cycle.
4. The error log stays empty during clean operation; populates correctly when we inject a fault.
5. The nightly healthcheck workflow runs at 04:17 UTC and opens an alert issue when we deliberately stale the state.
6. The federation outbound writes to `runtime/federation/outbox/dry/` (no live mode pre-`preLaunchVerified`).
7. AI provider routing demotes/promotes based on observed latency.

This step also closes most of `S-GATE-1` automatically — the 14-day clean stretch + signed proofs + dashboard reachable + closed-loop demo all live happen here, not in public.

---

## Step 4 — Fix bugs

Surface area: whatever the private-repo run discovers. Patch in tight commits. Don't refactor while bug-fixing.

---

## Step 5 — Owner punch list (the 7 items in `PLAN/SGATE_1.md`)

These cannot be done by code — they're owner actions with external accounts. Sequence:

1. `gh secret set NPM_TOKEN` (automation token) → publish workflow can ship `@orbit-house/sdk` + `create-orbit-house`.
2. Settings → Pages → Source: GitHub Actions → `orbit.horse` resolves.
3. `gh variable set ORBIT_AGENT_SIGNER --body 0x...` (the EOA the agent uses to sign proofs).
4. Neynar API key + signer UUID for Farcaster casting (`PLAN/SPECS/FARCASTER_CAST_PIPELINE.md §10`).
5. `gh variable set ORBIT_AI_PROVIDERS` + `gh secret set ORBIT_AI_PROVIDER_KEYS`.
6. Deploy the 7-Safe topology on Base per `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md`. Fund the Fee Receive Safe.
7. Observe 12 consecutive clean hours of cycles (24 cycles × 30 min) in the private repo, then flip `state.preLaunchVerified = true`.

`gh variable set ORBIT_MAINTAINERS --body "<your-handles>"` is recommended in parallel — it activates the quorum machinery shipped in Patch Set K.

---

## Step 6 — Full launch

After Steps 1–5:

1. Tag and publish: `git tag sdk-v0.1.0 && git push --tags` → `publish-packages.yml` ships SDK. Repeat for `create-orbit-house-v0.1.0`.
2. Public repo gets a final regen of `public/dashboard.json` from the now-live state.
3. Announcement cycle: first Farcaster cast under the public signer; first signed cycle proof anchored.
4. Open the **first public adopter approval issue** to invite the first external adopter.

Nothing about Step 6 is engineering — it's a sequenced ceremony the owner runs once.

---

## Step 7 — Hand over the finalised folder

Before pushing to the public repo, run:

```bash
npm run launch:build
```

The script (`scripts/build-launch-folder.js`) produces `launch-ready/` containing **only** what should be in the public artifact. It is the deliverable for "give me the finalised folder."

**What's in the folder:**
- `src/`, `packages/`, `tests/`, `scripts/` — all source.
- `.github/` — CI workflows.
- `docs/` — user-facing documentation only.
- `public/` — dashboard.json, .well-known, CNAME, robots, sitemap.
- `README.md`, `LICENSE`, `PUBLISHING.md`.
- `memory/identity.md`, `memory/infrastructure.json`, `memory/ai-providers.json` — the public surface.
- `memory/state.json`, `treasury.json`, `governance.json`, `tasks.json`, `orbit-lineage.json` — **clean template stubs** rendered from `packages/create-orbit-house/templates/`, identical to what `npx create-orbit-house` would produce.
- `lore/00-genesis.md`, `voice.md`, `README.md`, `cycles-of-note/README.md`.

**What's stripped:**
- `PLAN/` (this directory — internal planning + sequencing).
- `OWNER_ACTIONS.md` (operator runbook).
- `.remember/`, `.claude/` (session memory).
- `runtime/` (per-instance signed proofs, federation outbox).
- All live `memory/*` state: `state.json` (live), `treasury.json` (live), `cycles.jsonl`, `approvals.json`, `adopters-registry.json`, `knowledge.json`, `opportunities.json`, `missions.json`, `horizon-*.json`, `errors.jsonl`, `passport.json`, `feed-cache.json`, `idea-inbox.json`, `agent-sources.json`, `problem-lab.json`, `project-ideas.json`, `roadmap.json`, `buyback-ledger.json`, etc. — 19 files in total.
- `lore/cycles-of-note/<specific-entries>` (per-instance milestones).
- Build artifacts (`dist/`, `node_modules/`), env files.

**Audit hook:** the script runs a post-check that exits 1 if anything on the strip list leaks into the output. Adding a file to the whitelist is a deliberate, code-reviewable change.

Current stats (run 2026-05-26 after Patch Set Y):
- 337 files, 3.4 MB.
- `memory/`: 3 kept, 5 templated, 19 stripped.
- `lore/`: 4 kept, 0 specific entries to strip yet.

---

## Status snapshot — what's already true

| Capability | Status | Evidence |
|---|---|---|
| Wallet-signed cycle proofs | ✅ | `src/agent/proof-signing.js:69-169` + `packages/orbit-verifier/` |
| Farcaster cast pipeline | ✅ | `src/agent/farcaster.js` + tests |
| Closed-loop demo | ✅ | `PLAN/SPECS/CLOSED_LOOP_DEMO.md` + `tests/closed-loop-demo.test.js` |
| Scaffolder + SDK ready to publish | ✅ | `packages/{orbit-sdk,create-orbit-house}/package.json` (publish-ready metadata) |
| Multi-maintainer quorum live in CI | ✅ | Patch K — `orbit-cycle.yml` injects `ORBIT_MAINTAINERS` |
| Founder handoff lifecycle + executor | ✅ | Patches P + V |
| Horizon scanner running each cycle | ✅ | Patch R |
| Federation outbound primitive | ✅ | Patch U |
| Atomic writes across all hot paths | ✅ | Patches J + Q |
| Persistent error log + CLI + dashboard | ✅ | Patches M + S |
| Cycle-failure exponential backoff | ✅ | Patch W |
| Nightly self-healthcheck workflow | ✅ | Patch T |
| Treasury Safe deployed | ⏳ | Owner action (Step 5.6) |
| `preLaunchVerified` flipped | ⏳ | Owner action after Step 3 (12h clean stretch) |
| npm publish of public packages | ⏳ | Owner action (Step 5.1, then Step 6.1) |

1456/1456 tests pass. `npm audit` clean. Lint clean.

---

## Where this plan lives

This file (`PLAN/LAUNCH_PLAN.md`) is the single source of truth for the launch sequence. It supersedes any older "what's left" notes inside other docs. When a step completes, update its status here — not in a separate journal.
