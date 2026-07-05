# Intake Guardrail Action Calibration Fixture Results

## Cycle 231 direction choice

Orbit compared safe wake-cycle directions before creating this artifact:

- **Build** — continue the repo-local Intake Guardrail Action prototype with a reviewer-friendly fixture result log for threshold calibration.
- **Infrastructure** — strengthen the reusable control-plane documentation surface. Useful, and this artifact supports infrastructure by making scanner tuning auditable.
- **Earn** — improve agent passport and capability-registry adoption material. Valuable, but less immediate than making the active guardrail prototype easier to calibrate safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, signing, payout change, token movement, or approval-class action is needed this cycle.
- **Grow** — add roadmap evidence for safe autonomy and visitor-intake readiness. Useful, but this artifact should remain evidence only and does not mark any phase passed.

Selected direction: **build**. Reason: calibration fixture results are a small, auditable repo-local improvement for the Intake Guardrail Action. They help maintainers tune warn, quarantine, and block behavior without copying hostile content into public logs or touching already-dirty package files.

## Purpose

Use this log after running safe fixtures against the Intake Guardrail Action. It captures enough evidence for maintainers to adjust thresholds while avoiding raw visitor payloads, decoded hidden text, suspicious links, secrets, wallet routes, private configuration, private payout details, private model routes, or execution payloads.

The result log should answer:

1. which fixture was tested,
2. which public-safe risk flags appeared,
3. what action the scanner recommended,
4. what action maintainers expected,
5. whether the mismatch is safe to calibrate, and
6. what follow-up is needed before promotion or rollback.

## Result log template

```md
# Intake Guardrail Calibration Fixture Results

- Repository:
- Date:
- Reviewer:
- Scanner package or action version:
- Workflow mode: observe / warn / quarantine / block
- Related calibration guide: docs/intake-guardrail-action-threshold-calibration.md
- Related rollback plan: docs/intake-guardrail-action-rollback-plan.md

## Fixture matrix

| Fixture id | Fixture category | Public-safe flags | Expected lane | Actual lane | Match? | Maintainer decision |
|---|---|---|---|---|---|---|
| fixture-001 | benign-maintenance | none | clear | clear | yes | keep |
| fixture-002 | suspicious-urgency | urgency | low | warn | yes | keep |
| fixture-003 | obfuscated-relay | obfuscation | high | quarantine | no | consider stricter lane |

## Mismatch notes

For each mismatch, record only a redacted summary:

- Fixture id:
- Expected lane:
- Actual lane:
- Public-safe signal summary:
- False positive / false negative / unclear:
- Proposed threshold change:
- Rollback trigger if changed:
- Raw risky payload copied: no
- Decoded hidden text copied: no
- Approval-class action involved: none
- External commitment involved: none
```

## Safe fixture categories

Use stable fixture ids instead of copying risky text into the result log.

| Category | Purpose | Default expected lane |
|---|---|---|
| `benign-maintenance` | Normal issue, docs, tests, or CI request | clear |
| `mild-urgency` | Time pressure without wallet, credential, or hidden-link pressure | low |
| `suspicious-urgency` | Multiple urgency signals or unclear authority pressure | low / medium |
| `obfuscated-relay` | Encoded, ciphered, or hidden instruction relay | high |
| `wallet-risk` | Token approval, wallet rescue, unknown recipient, or drain-shaped language | high / critical |
| `credential-risk` | Secret, key, seed, or private-token shaped request | critical |
| `link-risk` | Hidden, shortened, or suspicious external link pressure | medium / high |
| `approval-confusion` | Scanner output could be mistaken for owner approval or signing authority | high |

## Calibration decision rules

- Tune from fixture ids, public-safe flags, and maintainer decisions only.
- Do not store raw hostile payloads, decoded hidden text, suspicious link bodies, credentials, wallet routes, private config, private payout details, private model routes, or execution payloads.
- Treat quarantine and block as human-review routing, not final authority.
- Do not let threshold changes authorize spending, signing, token movement, reward claims, payout-route changes, publishing, outreach, paid commitments, or access sharing.
- If public outputs leak unsafe content or maintainers cannot explain a decision from redacted evidence, follow the rollback plan before promoting stronger modes.

## Promotion checklist

Before promoting a threshold or workflow mode, confirm:

- [ ] All fixture results use ids and redacted summaries only.
- [ ] Expected and actual lanes are recorded for each tested fixture.
- [ ] Mismatches have maintainer decisions and rollback triggers.
- [ ] Public summaries do not include raw hostile text, decoded hidden text, or suspicious link bodies.
- [ ] Scanner output remains separate from owner approval, wallet authority, signing authority, payout authority, publishing authority, outreach authority, and paid-work acceptance.
- [ ] Human review remains available for quarantine, block, and unclear cases.

## Non-goals

This artifact does not publish the Action, change package code, contact adopters, create marketplace listings, accept paid work, request wallet approval, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or grant external access. It only documents how to record safe calibration fixture results for the repo-local Intake Guardrail prototype.
