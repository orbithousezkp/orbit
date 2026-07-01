# Intake Guardrail Action Threshold Calibration

## Cycle selection

This cycle compared the safe multi-direction options before acting:

- **Build**: continue the repo-local Intake Guardrail GitHub Action prototype with one adopter-facing safety artifact.
- **Infrastructure**: improve the reusable control-plane documentation surface.
- **Earn**: strengthen adoption readiness for future users without outreach or commitments.
- **Sustain**: clarify safety boundaries around wallet-risk and approval-class requests without touching live wallet actions.
- **Grow**: add evidence that supports roadmap maturity without marking any phase passed.

Selected direction: **build**. Reason: the Intake Guardrail Action remains the active repo-local prototype, and threshold calibration is a small, auditable adopter need that improves safe rollout behavior without modifying dirty package files, publishing, outreach, spend, signing, token movement, reward claims, payout-route changes, or external commitments.

## Purpose

Thresholds decide when a scan result should stay informational, warn a maintainer, quarantine an item, or block automation. They should be conservative enough to stop risky agent handoff, but not so noisy that maintainers ignore the guardrail.

This guide gives maintainers a public-safe way to calibrate thresholds using redacted fixtures, rollout receipts, and human review outcomes.

## Calibration principles

- Treat scanner output as a routing signal, not final authority.
- Prefer false positives over exposing agents to raw hostile payloads, encoded instructions, wallet-risk pressure, or credential-shaped text.
- Tune thresholds from redacted fixture outcomes and maintainer review receipts, not from copied hostile content.
- Keep high-risk lanes human-owned until maintainers have reviewed enough safe receipts to change policy.
- Record threshold changes as repo-local configuration decisions with a short reason and rollback path.

## Suggested threshold lanes

| Lane | Typical signal | Default action | Human review need |
| --- | --- | --- | --- |
| Clear | No meaningful risk flags | `allow` | Optional spot-check |
| Low | Mild urgency or suspicious phrasing without sensitive action pressure | `warn` | Review before agent follows instructions |
| Medium | Multiple suspicious signals, hidden-link pressure, or unclear intent | `quarantine` | Required before agent handoff |
| High | Obfuscated relay, wallet-risk language, approval pressure, or credential-shaped content | `block` | Required; do not pass raw text to agents |
| Critical | Seed/private-key requests, drain language, urgent wallet rescue, or unknown recipient pressure | `block` | Required; escalate with redacted receipt |

## Calibration workflow

1. Start in observe or warn mode with redacted summaries only.
2. Run the public-safe fixture matrix and compare expected actions to actual actions.
3. For each mismatch, record only fixture id, expected action, actual action, public-safe flags, and maintainer decision.
4. Adjust thresholds only when the reason is understandable from the receipt without raw risky text.
5. Promote to quarantine or block behavior gradually, with rollback criteria documented before promotion.

## Threshold change receipt

```text
Changed by: <maintainer or role>
Changed at: <YYYY-MM-DD>
Scanner ref: <package version or commit>
Previous lane/action: <lane/action>
New lane/action: <lane/action>
Evidence source: fixture id / rollout receipt / maintainer review packet
Raw risky payload copied: no
Reason: <short public-safe reason>
Rollback trigger: <false positive pattern or maintainer signal>
Approval-class action involved: none
External commitment involved: none
```

## Review checklist

Before accepting a threshold change, confirm:

- [ ] The evidence is public-safe and does not include raw hostile text.
- [ ] The change cannot authorize spending, signing, token movement, payout-route changes, publishing, outreach, access sharing, or paid commitments.
- [ ] The new behavior stops agent handoff for quarantine and block results.
- [ ] Maintainers retain final authority over comments, labels, check failures, and enforcement.
- [ ] A rollback trigger exists for unexpected false positives.
- [ ] Workflow summaries remain redacted and do not decode hidden content.

## Non-goals

This guide does not publish the Action, change package code, create marketplace listings, contact adopters, accept paid work, request approval-class action, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or grant external access. It only documents safe threshold calibration for the repo-local Intake Guardrail prototype.
