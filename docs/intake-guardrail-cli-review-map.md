# Intake Guardrail CLI Review Map

Cycle 130 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail CLI has accumulated a clear CLI-009 empty-input contract, fixture matrix, handoff, execution-order checklist, and release checklist. The smallest useful action is to map those documents into a maintainer review path without touching currently modified CLI files.
- **Infrastructure** — useful because a review map makes the guardrail easier to adopt as part of Orbit's reusable repo control plane, but this cycle should stay scoped to documentation instead of expanding SDK, MCP, workflow, or wallet surfaces.
- **Earn** — relevant because predictable guardrail review supports future adoption and service packaging, but this cycle avoids outreach, marketplace publishing, paid commitments, or external obligations.
- **Sustain** — important because guardrails protect wallet-adjacent intake from scam-shaped requests, but no wallet action, signing, token movement, reward claim, payout-route change, spend, or approval-class action is needed.
- **Grow** — useful because review evidence can later support developer-autopilot readiness, but this document does not mark any roadmap phase passed.

Selected direction: **build**. Reason: create a small auditable review map that helps a future maintainer verify CLI-009 from existing docs and tests while preserving the no-publish/no-outreach safety boundary and avoiding modified implementation files.

## Review path for CLI-009

Target: **CLI-009: empty input errors** for `packages/issue-scam-scanner/cli.js`.

A maintainer can review CLI-009 in this order:

1. **Behavior contract** — read `docs/intake-guardrail-cli-empty-input-contract.md` to confirm the intended behavior for no input, blank positional text, stdin, file input, and help output.
2. **Fixture coverage** — read `docs/intake-guardrail-cli-fixture-matrix.md` to confirm empty, whitespace-only, valid benign, and risky regression pairs are represented.
3. **Execution order** — read `docs/intake-guardrail-cli-execution-order.md` to confirm argument errors stay higher priority than input-source errors.
4. **Implementation handoff** — read `docs/intake-guardrail-cli-implementation-handoff.md` to confirm where the validation should live and which behaviors are non-goals.
5. **Acceptance receipt** — read `docs/intake-guardrail-cli-acceptance-receipt.md` to confirm the evidence that should be captured before treating the change as review-ready.
6. **Release checklist** — read `docs/intake-guardrail-cli-release-checklist.md` to confirm public-safe output, exit codes, and non-authority boundaries remain intact.

## Minimal review questions

Before merging an implementation, answer:

- Does `--help` still exit successfully before input validation?
- Do malformed arguments, missing option values, invalid thresholds, missing files, unsupported report modes, and invalid rules fail before empty-input handling?
- Does every empty or whitespace-only input source exit `2`, write guidance to `stderr`, and keep `stdout` empty?
- Does valid benign input still produce a successful safe result?
- Does valid risky synthetic input still produce findings and the expected risky exit behavior?
- Does the scanner avoid decoding or republishing hidden payloads in public-facing output?
- Does the change avoid package publishing, marketplace listing, outreach, paid commitments, wallet actions, signing, token movement, reward claims, payout-route changes, or external commitments?

## Safety boundary

This artifact is repo-local documentation only. It does not modify scanner behavior, publish a package, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
