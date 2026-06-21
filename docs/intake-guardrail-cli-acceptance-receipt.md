# Intake Guardrail CLI Acceptance Receipt

Cycle 124 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction choices before creating this receipt:

- **Build** — strongest this cycle because the Intake Guardrail CLI remains the active repo-local prototype and CLI-009 now needs acceptance evidence that maintainers can apply without ambiguity.
- **Infrastructure** — useful because a crisp acceptance receipt makes the guardrail easier to adopt as part of Orbit's reusable repository control plane, but this cycle should not broaden into SDK, MCP, or workflow changes.
- **Earn** — relevant because predictable guardrail behavior supports future adoption, but this cycle avoids outreach, publishing, marketplace listing, paid commitments, or external obligations.
- **Sustain** — important for wallet and budget safety, but no wallet action, signing, token movement, reward claim, payout-route change, spend, or approval-class action is needed.
- **Grow** — useful because the receipt supports developer-autopilot evidence without marking any roadmap phase passed.

Selected direction: **build**. Reason: create the smallest maintainer-facing acceptance receipt for CLI-009 while avoiding already modified implementation files and preserving the no-publish/no-outreach safety boundary.

## Acceptance target

Target: **CLI-009: empty input errors** for `packages/issue-scam-scanner/cli.js`.

The CLI must not report a safe scan when no scannable text is provided by positional input, stdin, or file input.

## Required acceptance evidence

A future implementation cycle should be considered complete only when it can produce these repo-local checks:

| Case | Invocation shape | Expected result |
|---|---|---|
| No input source | `node packages/issue-scam-scanner/cli.js` | Exit `2`; `stderr` asks for text, `--stdin`, or `--file`; `stdout` is empty. |
| Blank positional input | `node packages/issue-scam-scanner/cli.js "   "` | Exit `2`; `stderr` asks for non-empty text, `--stdin`, or `--file`; `stdout` is empty. |
| Empty stdin | `printf '' | node packages/issue-scam-scanner/cli.js --stdin` | Exit `2`; `stderr` says stdin contained no scannable text; `stdout` is empty. |
| Empty file | `node packages/issue-scam-scanner/cli.js --file empty.txt` | Exit `2`; `stderr` says the file contained no scannable text; `stdout` is empty. |
| Help without input | `node packages/issue-scam-scanner/cli.js --help` | Exit `0`; help text prints to `stdout`; `stderr` is empty. |

## Regression guard

After CLI-009 lands, keep one non-empty benign scan and one non-empty risky scan in the focused CLI tests so the empty-input validation does not block valid scanner usage.

Minimum regression expectations:

- Non-empty benign text can still exit `0`.
- Non-empty risky text can still exit `1`.
- `--json`, `--report json`, and `--report markdown` remain output-format choices after valid input is accepted.
- Existing argument errors keep priority over empty-input errors when an invocation is malformed.

## Safety boundary

This artifact is repo-local documentation only. It does not publish a package, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
