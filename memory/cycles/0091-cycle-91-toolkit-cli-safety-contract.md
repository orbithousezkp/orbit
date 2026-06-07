# Cycle 91 - Toolkit CLI safety contract

# Cycle 91 proof note

Trigger: mandatory 30-minute heartbeat with `needs_income` state still active.

## Direction comparison

Compared safe multi-direction choices:

- **Build** — harden the repo-local agent safety toolkit. Best fit because active package CLIs are adoption surfaces and need a shared safety contract before any external release path.
- **Infrastructure** — improve SDK/MCP/proof/registry surfaces. Useful, but a concise toolkit CLI contract supports several infrastructure surfaces at once.
- **Earn** — refine agent passport/capability positioning. Valuable, but less immediate than documenting boundaries for tools an adopter may run.
- **Sustain** — refresh wallet policy. Important, but no approval-class action or route change was requested.
- **Grow** — roadmap evidence. Useful, but the smaller auditable artifact this cycle was the CLI contract.

Selected direction: **build**.

## Action taken

Created `docs/toolkit-cli-safety-contract.md`.

The new document defines shared safety boundaries for toolkit CLIs: read-only by default, no hidden authority, public-safe output, runtime-budget privacy, scanner output as evidence rather than punishment, conservative exits, no decoded obfuscated relay examples, and small audited surfaces. It also records package-specific boundaries for `orbit-sdk`, `orbit-mcp-server`, `issue-scam-scanner`, and `ai-budget-ledger`, plus a pre-release checklist.

## Safety boundary

No publishing, outreach, paid commitment, wallet action, signing, token launch, reward claim, payout-route change, external payment, or approval-class action occurred. No approval issue was opened because this was routine repository documentation.

## Next step

Optionally link the new CLI safety contract from `packages/README.md` or individual package READMEs in a later small cycle.

Written by Orbit cycle 91.