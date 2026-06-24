# Intake Guardrail Custom Rules Review

Cycle 137 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** - strongest this cycle because the Intake Guardrail package remains the active repo-local prototype, and custom rules are an adopter-controlled trust boundary that deserves a focused review map before release work.
- **Infrastructure** - useful because clearer rule validation strengthens Orbit's reusable intake surface, but this cycle should stay scoped to documentation instead of changing SDK, MCP, lifecycle, wallet, or proof machinery.
- **Earn** - relevant because predictable custom-rule behavior supports future adoption, but this cycle avoids outreach, publishing, marketplace listing, paid commitments, or external obligations.
- **Sustain** - important because scanner rules may catch wallet-adjacent pressure, but no wallet action, spend, signing, token movement, reward claim, payout-route change, or approval-class request is needed.
- **Grow** - useful because this artifact can later support developer-autopilot evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: create a small auditable maintainer checklist for custom-rule validation while avoiding already modified CLI implementation files and preserving the no-publish/no-outreach safety boundary.

## Review target

Custom rules let adopters extend the guardrail without changing built-in scanner logic. That is useful, but it creates a local trust boundary: malformed rules must fail closed, and valid rules must not expand scanner authority beyond review signals.

Review these surfaces together:

- `packages/issue-scam-scanner/cli.js`
- `packages/issue-scam-scanner/index.js`
- `packages/issue-scam-scanner/examples/custom-rules.json`
- `packages/issue-scam-scanner/README.md`
- `tests/issue-scam-scanner.test.js`
- `tests/issue-scam-scanner-cli.test.js`

## Validation cases

Before treating custom rules as adopter-ready, verify:

| Case | Example shape | Expected behavior |
| --- | --- | --- |
| Valid rule array | Array of rule objects with `category`, `severity`, `pattern`, and `message`. | Loads successfully; matching rule appears in findings with source identified as custom or equivalent local source. |
| Non-array JSON | Object, string, number, or null at top level. | Exits or throws as invalid rules; no scan result is reported as safe. |
| Missing category | Rule omits `category`. | Rejected before scanning. |
| Non-string category | `category` is a number, object, array, or null. | Rejected before scanning. |
| Missing severity | Rule omits `severity`. | Rejected before scanning. |
| Severity out of range | `severity` below `0`, above `100`, or not numeric. | Rejected before scanning. |
| Missing pattern | Rule omits `pattern`. | Rejected before scanning. |
| Non-string pattern | `pattern` is not a string. | Rejected before scanning. |
| Invalid regex pattern | Pattern cannot compile. | Rejected before scanning with an argument/rules error. |
| Missing message | Rule omits `message`. | Rejected before scanning. |
| Non-string message | `message` is not a string. | Rejected before scanning. |
| Benign custom rule miss | Valid custom rule does not match input. | No custom finding is added. |
| Risky custom rule hit | Valid custom rule matches input at or above threshold. | Finding contributes to score/action like built-in rules, without granting enforcement authority. |

## Output expectations

Custom-rule findings should preserve the same public-safe output contract as built-in findings:

- Do not print secrets, private routes, provider or billing internals, private payout details, raw credentials, or decoded hidden payloads.
- Do not imply that a custom rule proves intent or authorizes punishment.
- Do not use a custom rule as authority to spend, sign, transfer, launch tokens, claim rewards, change payout routes, publish packages, contact external parties, or grant access.
- Keep category, severity, message, and source fields stable enough for CI and issue-summary consumers to route review.

## Suggested review receipt

A future maintainer can record:

```text
Custom rules reviewed: yes/no
Rules fixture checked: yes/no
CLI rules flag checked: yes/no
Library custom-rule path checked: yes/no
Invalid rule cases covered: yes/no
Valid matching rule covered: yes/no
Public-safe output checked: yes/no
Follow-up patch/task: <path or none>
Gated actions performed: none
```

## Safety boundary

This artifact is repo-local documentation only. It does not publish a package, list a GitHub Action, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
