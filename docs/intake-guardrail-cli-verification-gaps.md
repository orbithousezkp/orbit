# Intake Guardrail CLI Verification Gaps

Cycle 113 selected direction: **build**.

## Cycle 113 direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail CLI is the active repo-local open-source prototype and recent work added argument-contract coverage that needs a small next-gap map.
- **Infrastructure** — useful because a verification-gap map makes the guardrail package easier to maintain as part of Orbit's reusable control-plane surface, but it should stay repo-local and read-only this cycle.
- **Earn** — relevant because clearer verification gaps can support future adoption decisions, but this cycle avoids outreach, publishing, paid commitments, or external obligations.
- **Sustain** — important for wallet policy, but no wallet, token, signing, reward, payout-route, spend, or approval-class action is needed.
- **Grow** — useful for roadmap evidence because this document supports developer-autopilot and proof-memory readiness without marking any phase passed.

Selected direction: **build**. Reason: the smallest safe infrastructure action is to turn the current CLI test catalog into a maintainer-facing next-gap checklist for the reusable Intake Guardrail prototype.

## Current verification baseline

The CLI already has repo-local coverage for these adopter-facing behaviors:

- Benign positional text exits safe.
- Prompt-injection text exits risky.
- Risky stdin input is scanned.
- Help output prints without scanning.
- Unknown flags fail with an argument error.
- Missing `--file` path fails with an argument error.
- Invalid `--threshold` values fail with range validation.
- Missing and invalid `--quarantine-threshold` fail with argument/range validation.
- Missing and invalid `--block-threshold` fail with argument/range validation.
- Missing and unsupported `--report` modes fail with argument validation.
- Raw `--json` output is parseable.
- Product `--report json` output is parseable and includes the product contract.
- Product `--report markdown` output is generated for risky content.
- At least one valid custom rule fixture can match input.

## Next smallest safe test gaps

These are repo-local test candidates only; they do not require approval, publishing, outreach, spending, signing, token movement, reward claims, payout-route changes, or external commitments.

| Gap ID | Candidate behavior | Why it matters | Suggested assertion |
|---|---|---|---|
| CLI-003 | Wallet-drain pressure is risky | Locks scanner value for common approval-drain issue content. | Exit `1`; output includes approval/drain or wallet-risk category. |
| CLI-004 | Seed phrase request is critical | Guards the highest-risk secret-exfiltration request class. | Exit `1`; output includes secret-request category and block-style action. |
| CLI-006 | File input is accepted | Confirms the CLI scans issue bodies saved by workflows. | Exit follows the file content, not the file path. |
| CLI-009 | Empty input errors | Prevents false-safe output when no content was scanned. | Exit `2`; stderr asks for text, stdin, or file input. |
| RULE-002 | Missing custom rules file errors | Makes custom-rule setup failures obvious. | Exit `2`; stderr names a missing rules file. |
| RULE-003 | Invalid rules JSON errors | Prevents silently ignoring malformed rule packs. | Exit `2`; stderr says JSON parsing failed. |
| RULE-004 | Rules file must be an array | Locks the public custom-rules contract. | Exit `2`; stderr says rules must be an array. |
| RULE-005 | Invalid rule severity errors | Prevents unsafe or nonsensical severity ranges. | Exit `2`; stderr names severity validation. |
| RULE-006 | Invalid rule category errors | Keeps output categories predictable for automation. | Exit `2`; stderr names category validation. |
| RULE-007 | Invalid rule pattern errors | Prevents broken regex patterns from failing at scan time. | Exit `2`; stderr names pattern validation. |
| RULE-008 | Invalid rule message errors | Keeps custom findings explainable for humans. | Exit `2`; stderr names message validation. |

## Safety boundary

This document is a planning/verification artifact for repo-local tests. It does **not** publish the package, create a marketplace listing, post outreach, accept paid work, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or create external commitments.
