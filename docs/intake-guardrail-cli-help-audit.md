# Intake Guardrail CLI Help Audit

Cycle 132 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail CLI remains the active repo-local prototype, and the help text is the first interface a maintainer or adopter sees before running scans.
- **Infrastructure** — useful because help accuracy supports Orbit's reusable control-plane surface, but this cycle should stay scoped to a small guardrail artifact instead of expanding SDK, MCP, workflow, or wallet layers.
- **Earn** — relevant because clear CLI usage supports future adoption, but this cycle avoids outreach, package publishing, marketplace listing, paid commitments, or external obligations.
- **Sustain** — important because intake guardrails protect wallet-adjacent requests, but no wallet action, token movement, reward claim, payout-route change, spend, signing, or approval-class action is needed.
- **Grow** — useful because review evidence can later support developer-autopilot readiness, but this note does not mark any roadmap phase passed.

Selected direction: **build**. Reason: create a small auditable help-audit checklist that strengthens the existing repo-local Intake Guardrail prototype while preserving the no-publish/no-outreach safety boundary.

## Help audit target

Target: `packages/issue-scam-scanner/cli.js --help`.

The help output should remain aligned with:

- `packages/issue-scam-scanner/README.md`
- `docs/intake-guardrail-cli-empty-input-contract.md`
- `docs/intake-guardrail-cli-release-checklist.md`
- `docs/intake-guardrail-cli-review-map.md`
- `tests/issue-scam-scanner-cli.test.js`

## Maintainer checklist

Before treating CLI help as release-ready, verify:

- [ ] Every documented flag is accepted by the parser.
- [ ] Every accepted flag appears in the help output unless intentionally hidden for internal use.
- [ ] `--threshold`, `--quarantine-threshold`, and `--block-threshold` document valid ranges and default behavior.
- [ ] `--report summary`, `--report markdown`, `--report json`, and `--json` have distinct, understandable semantics.
- [ ] Input sources are clear: positional text, `--stdin`, and `--file`.
- [ ] Empty or whitespace-only input behavior matches the CLI-009 contract.
- [ ] Exit codes match actual behavior: `0` safe, `1` risky, `2` argument or input error.
- [ ] Custom rule schema in help matches validation in `packages/issue-scam-scanner/scan.js`.
- [ ] Examples avoid real wallet addresses, live claim links, secrets, private routes, or decoded hidden payloads.
- [ ] Help text does not imply the scanner can authorize enforcement, wallet actions, signing, payments, publishing, or external commitments.

## Evidence to capture

A release or review receipt should include:

- the exact command used to print help;
- a short note that the output was compared against README usage;
- any mismatches found;
- the follow-up issue, task, or patch path if help drift exists;
- confirmation that no gated action was performed.

## Safety boundary

This artifact is repo-local documentation only. It does not publish the package, list a GitHub Action, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
