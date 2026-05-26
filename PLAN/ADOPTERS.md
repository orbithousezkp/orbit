# Orbit — Adopters

> Repos that have adopted Orbit as their control plane. Each adopter is its own sovereign Orbit instance (own cron, own signer, own FID, own treasury). This file tracks them so the mothership can cross-cast milestones and S-GATE-1 criterion #5 (≥1 second adopter repo) has a public record.

> **Source of truth for the count.** The machine-readable registry is `memory/adopters-registry.json`. The cycle auto-verifies the 3-criteria definition (green cycle 7d / dashboard reachable / well-known valid) on every run and writes `public/adopters.json`. This narrative page below stays as per-adopter detail; the table is illustrative.

> **Sequencing rule.** No adopter work begins until the private-repo rehearsal of the public-ready Orbit has closed successfully (see `docs/REHEARSAL_RUNBOOK.md`). Entries below are planning artifacts until the rehearsal closes.

> **Handshake protocol.** See `PLAN/SPECS/ADOPTER_HANDSHAKE.md` for how adopters self-register (one issue, no signing required — lineage backlink in their well-known is the proof). For manual seeding: `npm run orbit:adopter -- add --repo owner/name --well-known URL`.

## Adopter index

| Slug | Repo | Status | Phase | Last signed cycle | Notes |
|---|---|---|---|---|---|
| gitty | `(owner)/gitty` (not yet created) | planned | Phase 0 — blocked on npm publish | — | Security-focused Debian arm64 distro for rooted Android. AI dev toolchain. |

## gitty — adopter detail

**Mission.** A security-focused Debian arm64 Linux distro for rooted Android phones. Bundles open-source security + developer + AI tooling (Aider, llama.cpp, Continue, LiteLLM). Closed-source coding agents (Claude Code, Cursor, Codex, GitHub Copilot CLI) are installed by first-run scripts — never bundled, never redistributed.

**Why Orbit drives it.** gitty's build pipeline is multi-phase (rootfs → kernel → chroot wrapper → security layer → dev layer → AI layer → image → installer → docs) and benefits from the same approval-gated, signed-cycle, public-cast pattern Orbit gives every adopter. Each build phase becomes one or more cycles, each release artifact is named in a signed proof, and Farcaster casts make progress public.

**Architecture.**
- gitty lives in its own public GitHub repo, scaffolded via `npx @orbit-house/create-orbit-house`
- Standard Orbit workflows (`orbit-cycle.yml`, `orbit-event.yml`) plus two custom workflows: `gitty-build.yml` (debootstrap on push to `build/*` branches) and `gitty-release.yml` (D-014 approval-gated tag → signed Release)
- Separate signer key, separate Farcaster FID, no treasury required for v0.1
- Orbit drives the build by reading `memory/roadmap.json`, performing branch pushes + issue comments via existing tools, then reading build status comments on the next cycle

**Roadmap phases.** A. base rootfs · B. kernel · C. chroot wrapper · D. open-source security toolchain · E. open-source dev toolchain · F. open-source AI toolchain (bundled) · G. closed-source AI toolchain (first-run installers) · H. signed image artifact · I. one-line installer · J. docs · K. telemetry-free verification.

**Sequencing.**
- **Blocks first** on the private-repo rehearsal of the public-ready Orbit completing (see `docs/REHEARSAL_RUNBOOK.md`). Gitty does not start until the rehearsal closes.
- Then blocks on S-GATE-1 punch list item #5 (npm publish of `@orbit-house/create-orbit-house`, `@orbit-house/sdk`, `@orbit-house/verifier`).
- Does **not** depend on the rehearsal token outcome itself, the Treasury Safe, or D-018 work beyond what the rehearsal already validates.
- Federation handshake (gitty → mothership `INTEL_SHARE`) waits on federation phase-3 outbound wiring.

**License posture.** MIT wrapper around upstream open-source packages. License attributions ship in the image at `/usr/share/doc/gitty/LICENSES`. Closed-source installers explicitly fetch from upstream — gitty redistributes none of them.

**Public surface.** Farcaster posts from gitty's FID using the `milestone` template (per `src/agent/farcaster.js` six-template surface) on each phase landing. Mothership cross-casts manually until federation outbound lands.
