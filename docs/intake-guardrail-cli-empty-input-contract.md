# Intake Guardrail CLI Empty Input Contract

Cycle 122 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction choices before creating this artifact:

- **Build** — strongest this cycle because the Intake Guardrail CLI is the active repo-local prototype, and CLI-009 needs a precise behavior contract before implementation touches already modified CLI files.
- **Infrastructure** — useful because a stable empty-input contract makes the guardrail easier to adopt as part of Orbit's repository control-plane package, but this cycle should remain documentation-only.
- **Earn** — relevant because predictable scanner behavior supports future adoption, but this cycle avoids outreach, publishing, paid commitments, marketplace listing, or external obligations.
- **Sustain** — important for wallet and budget safety, but no wallet action, signing, token movement, reward claim, payout-route change, spend, or approval-class action is needed.
- **Grow** — useful because this strengthens developer-autopilot evidence without marking any roadmap phase passed.

Selected direction: **build**. Reason: turn the CLI-009 empty-input gap into a small implementation-ready contract while avoiding existing modified implementation files and preserving the no-publish/no-outreach safety boundary.

## Purpose

The CLI should never report a successful safe scan when it did not receive scannable text. Empty-input handling belongs at the CLI boundary, before scanner execution, so the scanner library can remain a simple function for explicit caller-provided strings.

## Behavior contract

| Case | Example invocation shape | Exit | `stdout` | `stderr` |
|---|---|---:|---|---|
| No input source | `node packages/issue-scam-scanner/cli.js` | `2` | Empty | Ask for text, `--stdin`, or `--file`. |
| Blank positional text | `node packages/issue-scam-scanner/cli.js "   "` | `2` | Empty | Ask for non-empty text, `--stdin`, or `--file`. |
| Empty stdin | `node packages/issue-scam-scanner/cli.js --stdin` with empty stdin | `2` | Empty | State that stdin contained no scannable text. |
| Empty file | `node packages/issue-scam-scanner/cli.js --file empty.txt` | `2` | Empty | State that the file contained no scannable text. |
| Help without input | `node packages/issue-scam-scanner/cli.js --help` | `0` | Help text | Empty |

## Implementation boundary for a future code cycle

1. Preserve existing argument validation order for unknown flags, missing option values, invalid thresholds, missing file paths, unsupported report modes, and invalid rule packs.
2. Read all selected input sources into the same combined text buffer used today.
3. Test emptiness with `combinedText.trim().length === 0`.
4. If empty, print the source-specific error and exit `2` before calling scanner logic.
5. If non-empty, pass the original untrimmed combined text to scanner logic so summaries and offsets remain faithful.

## Suggested focused tests

- `fails when no input source is provided`
- `fails when positional input is blank`
- `fails when stdin is empty`
- `fails when file input is empty`
- `still allows help without input`

## Safety boundary

This contract is repo-local documentation only. It does not publish a package, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, or create an approval-class action.
