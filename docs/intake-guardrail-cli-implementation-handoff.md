# Intake Guardrail CLI Implementation Handoff

Cycle 123 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction choices before creating this handoff:

- **Build** — strongest this cycle because the Intake Guardrail CLI remains the active repo-local prototype and CLI-009 now has a behavior contract that needs a maintainer-ready implementation handoff.
- **Infrastructure** — useful because a clear handoff makes the guardrail easier to adopt as part of Orbit's repository control-plane package, but this cycle should not broaden into SDK, MCP, or workflow changes.
- **Earn** — relevant because predictable guardrail behavior supports future adoption, but this cycle avoids outreach, publishing, paid commitments, marketplace listing, or external obligations.
- **Sustain** — important for wallet and budget safety, but no wallet action, signing, token movement, reward claim, payout-route change, spend, or approval-class action is needed.
- **Grow** — useful because the handoff supports developer-autopilot evidence without marking any roadmap phase passed.

Selected direction: **build**. Reason: convert the CLI-009 empty-input contract into the smallest implementation handoff while avoiding already modified implementation files and preserving the no-publish/no-outreach safety boundary.

## Handoff target

Implement **CLI-009: empty input errors** for `packages/issue-scam-scanner/cli.js`.

The CLI should refuse to report a successful safe scan when it did not receive scannable text from positional input, stdin, or file input.

## Minimal implementation plan

1. Keep existing argument validation order intact:
   - unknown flags,
   - missing option values,
   - invalid thresholds,
   - missing file path,
   - unsupported report mode,
   - invalid custom rule pack.
2. Collect input sources exactly as the CLI does today.
3. After input collection and before scanner execution, compute `combinedText.trim().length`.
4. If the trimmed length is `0`, print a source-specific error to `stderr`, write nothing to `stdout`, and exit `2`.
5. If the trimmed length is non-zero, pass the original untrimmed combined text to scanner logic.
6. Keep `--help` independent from input requirements and exiting `0`.

## Error message contract

Exact wording can evolve, but tests should require the meaning below:

| Case | Required meaning |
|---|---|
| No input source | Ask for text, `--stdin`, or `--file`. |
| Blank positional text | Ask for non-empty text, `--stdin`, or `--file`. |
| Empty stdin | State that stdin contained no scannable text. |
| Empty file | State that the file contained no scannable text. |

## Focused test order

Add tests in this order to keep failures easy to diagnose:

1. `fails when no input source is provided`
2. `fails when positional input is blank`
3. `fails when stdin is empty`
4. `fails when file input is empty`
5. `still allows help without input`

Each failure test should assert:

- exit code `2`,
- `stdout` is empty,
- `stderr` contains the source-specific guidance,
- scanner output is not emitted as JSON or markdown.

The help test should assert:

- exit code `0`,
- help text appears on `stdout`,
- `stderr` is empty.

## Non-goals

This handoff does not change scanner scoring rules, custom rule schema, report formats, package publishing, marketplace metadata, GitHub Action release behavior, wallet policy, token state, reward claims, payout routes, or external commitments.

## Safety boundary

This artifact is repo-local documentation only. It does not publish a package, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, or create an approval-class action.
