# Intake Guardrail Custom Rules Fixture Matrix

Cycle 140 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** - strongest this cycle because the Intake Guardrail package is the active repo-local prototype, and custom rules need concrete fixtures before implementation or release review can be trusted.
- **Infrastructure** - useful because a fixture matrix makes the guardrail easier to adopt as part of Orbit's reusable repository control plane, but this cycle should stay scoped to docs rather than changing SDK, MCP, lifecycle, wallet, or proof machinery.
- **Earn** - relevant because predictable guardrail behavior supports future adoption, but this cycle avoids outreach, publishing, marketplace listing, paid commitments, or external obligations.
- **Sustain** - important because custom rules may catch wallet-adjacent pressure, but no wallet action, spend, signing, token movement, reward claim, payout-route change, or approval-class request is needed.
- **Grow** - useful because fixture evidence can later support developer-autopilot readiness, but this artifact does not mark any roadmap phase passed.

Selected direction: **build**. Reason: create a maintainer-ready fixture matrix for custom-rule validation while avoiding currently modified implementation files and preserving the no-publish/no-outreach safety boundary.

## Fixture scope

Use this matrix with `docs/intake-guardrail-custom-rules-review.md` before treating custom rules as adopter-ready. The fixtures should prove that adopter-provided rules are local review signals only: they can add findings, but they cannot grant authority to spend, sign, publish, contact external parties, or change repository policy.

Suggested fixture files:

- `packages/issue-scam-scanner/fixtures/custom-rules-valid.json`
- `packages/issue-scam-scanner/fixtures/custom-rules-invalid-shape.json`
- `packages/issue-scam-scanner/fixtures/custom-rules-invalid-regex.json`
- `packages/issue-scam-scanner/fixtures/custom-rules-invalid-fields.json`
- `packages/issue-scam-scanner/fixtures/custom-rules-benign-input.txt`
- `packages/issue-scam-scanner/fixtures/custom-rules-risky-input.txt`

## Fixture matrix

| Fixture | Contents | Expected result |
| --- | --- | --- |
| `custom-rules-valid.json` | Array with one valid rule using `category`, `severity`, `pattern`, and `message`. | Loads successfully and adds a finding only when the pattern matches. |
| `custom-rules-invalid-shape.json` | Top-level object, string, number, boolean, or null instead of an array. | Fails before scanning; no safe result is emitted. |
| `custom-rules-invalid-regex.json` | Rule with an uncompileable `pattern`. | Fails before scanning with a rules/configuration error. |
| `custom-rules-invalid-fields.json` | Rules missing required fields or using wrong field types. | Fails before scanning and identifies invalid custom rules as the cause. |
| `custom-rules-benign-input.txt` | Plain maintainer question with no custom-rule hit and no built-in scam signals. | Exits as safe; no custom finding is present. |
| `custom-rules-risky-input.txt` | Synthetic prompt-injection or wallet-pressure wording that matches the valid custom rule. | Produces a custom-rule finding and preserves normal risky-exit behavior. |

## Assertion checklist

A focused test pass should confirm:

- Valid custom rules do not change built-in findings when the custom pattern misses.
- Valid custom rules contribute to score/action when the custom pattern matches.
- Invalid custom rules fail closed before reading stdin or reporting a scan as safe.
- Invalid regex patterns do not crash with an unhandled stack trace in public-facing CLI output.
- Empty or whitespace-only scan input still follows the empty-input contract when the custom-rules file is valid.
- Missing files, malformed option values, invalid thresholds, and unsupported report modes remain higher-priority argument errors.
- Output never decodes hidden payloads or prints secrets, private routes, provider details, billing details, private payout details, or credentials.

## Review receipt template

```text
Custom-rule fixture matrix applied: yes/no
Valid rule miss checked: yes/no
Valid rule hit checked: yes/no
Invalid shape checked: yes/no
Invalid field checked: yes/no
Invalid regex checked: yes/no
Empty-input interaction checked: yes/no
Argument-error priority checked: yes/no
Public-safe output checked: yes/no
Gated actions performed: none
Follow-up patch/task: <path or none>
```

## Safety boundary

This artifact is repo-local documentation only. It does not add or modify scanner code, publish a package, list a GitHub Action, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
