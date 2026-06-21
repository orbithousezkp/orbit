# Intake Guardrail CLI Fixture Matrix

Cycle 126 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction choices before creating this fixture matrix:

- **Build** — strongest this cycle because recent CLI-009 notes define empty-input behavior, acceptance evidence, and harness assertions; the next smallest useful artifact is a fixture matrix that tells maintainers exactly which sample inputs should drive tests without touching dirty implementation files.
- **Infrastructure** — valuable because predictable fixtures make the Intake Guardrail package easier to reuse as Orbit control-plane infrastructure, but this cycle should stay focused on the repo-local guardrail prototype rather than SDK, MCP, or live workflow expansion.
- **Earn** — relevant because adopter-ready guardrails can support future services, but this cycle avoids publishing, outreach, marketplace listings, paid commitments, or external obligations.
- **Sustain** — important for wallet and budget boundaries, but no wallet action, signing, token movement, reward claim, payout-route change, spend, or approval-class action is needed.
- **Grow** — useful because the matrix can later support developer-autopilot evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: add the smallest maintainer-facing bridge from CLI-009 behavior notes to concrete test fixtures while preserving the no-publish/no-outreach safety boundary.

## Purpose

This matrix turns the CLI-009 empty-input contract into concrete fixture inputs for `tests/issue-scam-scanner-cli.test.js` or an equivalent future harness.

The fixtures should prove that the CLI rejects empty input sources before emitting scanner output, while still allowing valid benign and risky scans.

## Fixture matrix

| Fixture id | Input route | Fixture content | Expected exit | Expected stdout | Expected stderr |
|---|---|---|---:|---|---|
| `no-source` | no positional, no `--stdin`, no `--file` | none | `2` | empty | includes guidance to provide text, stdin, or file input |
| `blank-positional-spaces` | positional text | spaces only | `2` | empty | includes guidance that positional input is empty |
| `blank-positional-newlines` | positional text | newline-only string | `2` | empty | includes guidance that positional input is empty |
| `empty-stdin` | `--stdin` | zero bytes | `2` | empty | includes guidance that stdin was empty |
| `whitespace-stdin` | `--stdin` | spaces/newlines only | `2` | empty | includes guidance that stdin was empty |
| `empty-file` | `--file <path>` | real existing empty file | `2` | empty | includes guidance that file input was empty |
| `whitespace-file` | `--file <path>` | spaces/newlines only | `2` | empty | includes guidance that file input was empty |
| `help-no-input` | `--help` | none | `0` | usage text | empty |
| `benign-text` | positional text | `Please review this issue for documentation clarity.` | `0` | normal scanner output | empty or non-error diagnostics only |
| `risky-text` | positional text | safe synthetic wallet-drain wording from existing tests | `1` | normal scanner output with finding | empty or non-error diagnostics only |

## Fixture rules

- Keep risky fixture wording synthetic and non-actionable; do not include live links, wallet addresses, private keys, seed phrases, or hidden payloads.
- For empty file cases, create a real temporary file. Do not reuse the missing-file-path case because that belongs to argument validation, not CLI-009.
- For whitespace-only cases, treat trimmed content as empty.
- For `--help`, skip all input-source validation.
- For empty-input failures, ensure stdout stays empty so automation cannot misread the result as a clean scanner report.

## Regression guards

When implementing this matrix, keep these existing behaviors ahead of CLI-009:

1. Unknown flags still fail as argument errors.
2. Missing option values still fail as argument errors.
3. Invalid thresholds still fail before input scanning.
4. Missing file paths still fail before empty-file checks.
5. Invalid custom rule packs still fail before scanner execution.
6. Unsupported report modes still fail before scanner execution.

## Safety boundary

This artifact is repo-local documentation only. It does not publish a package, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
