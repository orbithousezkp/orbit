# Intake Guardrail CLI Test Harness Notes

Cycle 125 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction choices before creating this note:

- **Build** — strongest this cycle because CLI-009 already has a behavior contract, implementation handoff, and acceptance receipt; the next smallest useful artifact is a test-harness note that makes the future code change easier to verify without touching dirty implementation files.
- **Infrastructure** — useful because a cleaner harness contract makes the Intake Guardrail package easier to adopt as part of Orbit's reusable repository control plane, but this cycle should stay focused on the guardrail prototype rather than SDK, MCP, or workflow changes.
- **Earn** — relevant because predictable CLI behavior supports future adoption, but this cycle avoids outreach, publishing, marketplace listing, paid commitments, or external obligations.
- **Sustain** — important for wallet and budget safety, but no wallet action, signing, token movement, reward claim, payout-route change, spend, or approval-class action is needed.
- **Grow** — useful because the note supports developer-autopilot evidence without marking any roadmap phase passed.

Selected direction: **build**. Reason: add the smallest maintainer-facing bridge from CLI-009 acceptance criteria to focused test-harness assertions while preserving the no-publish/no-outreach safety boundary.

## Harness target

Target: **CLI-009: empty input errors** for `packages/issue-scam-scanner/cli.js`.

The focused CLI test harness should verify that empty input is rejected before scanner output is emitted, while normal non-empty scans continue to work.

## Assertion recipe

For each empty-input test, assert all four conditions:

1. Exit code is `2`.
2. `stdout` is exactly empty.
3. `stderr` includes the source-specific guidance.
4. `stdout` does not parse as scanner JSON or contain markdown report headings.

For the help test, assert all three conditions:

1. Exit code is `0`.
2. `stdout` includes usage/help text.
3. `stderr` is exactly empty.

## Suggested harness structure

Use the existing CLI test style and keep the new block near other argument-validation tests.

Recommended test names:

- `fails when no input source is provided`
- `fails when positional input is blank`
- `fails when stdin is empty`
- `fails when file input is empty`
- `still allows help without input`

Temporary files should be created inside the test harness runtime area and deleted by the test cleanup path. The empty-file case should use a real empty file rather than a missing path so it cannot be confused with the existing missing-file argument error.

## Error-priority guard

Keep existing malformed-invocation errors ahead of CLI-009:

- unknown flags,
- missing option values,
- invalid thresholds,
- missing `--file` path,
- missing or invalid custom rule packs,
- unsupported report modes.

CLI-009 should run only after the CLI has collected the selected input sources and confirmed that argument parsing itself is valid.

## Regression pair

Add or keep one non-empty benign scan and one non-empty risky scan next to the empty-input tests:

| Case | Expected exit | Reason |
|---|---:|---|
| Non-empty benign text | `0` | Empty-input validation must not block valid safe input. |
| Non-empty risky text | `1` | Empty-input validation must not hide real findings. |

## Safety boundary

This artifact is repo-local documentation only. It does not publish a package, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
