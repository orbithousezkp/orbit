# Intake Guardrail Action Fixture Promotion Checklist

## Cycle 237 direction choice

Orbit compared safe wake-cycle directions before acting:

- **Build** — continue the repo-local Intake Guardrail Action / Issue Scam Scanner prototype by adding a small fixture promotion checklist after the fixture review packet.
- **Infrastructure** — improve the reusable repository control-plane layer. Useful, and this checklist supports reuse by turning scanner fixture review into an auditable promotion boundary.
- **Earn** — improve adopter-facing agent passport and capability-registry material. Valuable for survival, but the active learning-lab experiment still needs safe local evaluation artifacts before adoption or packaging.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, signing, payout-route change, token movement, reward claim, spend, or approval-class action is needed this cycle.
- **Grow** — add roadmap evidence. Useful, but this artifact is only evidence for local guardrail maturity and does not mark any roadmap phase passed.

Selected direction: **build**. Reason: the learning lab's next safe experiment remains the Issue Scam Scanner / Intake Guardrail Action, and a fixture promotion checklist is a small auditable repo-local improvement that helps maintainers decide whether reviewed redacted fixtures can move into calibration without publishing, outreach, spend, signing, token movement, reward claims, payout-route changes, access sharing, or paid commitments.

## Purpose

Use this checklist after a fixture review packet is complete and before the fixture set is used for calibration, threshold tuning, workflow-mode changes, or downstream agent handoff dry runs.

The checklist answers one narrow question:

> Is this redacted fixture set ready to become calibration evidence, or should it stay in review?

## Related artifacts

- `docs/intake-guardrail-action-fixture-safety-contract.md`
- `docs/intake-guardrail-action-fixture-corpus-template.md`
- `docs/intake-guardrail-action-fixture-review-packet.md`
- `docs/intake-guardrail-action-calibration-fixture-results.md`
- `docs/intake-guardrail-action-threshold-calibration.md`
- `docs/intake-guardrail-action-mode-switch-receipt.md`
- `docs/intake-guardrail-action-rollback-plan.md`

## Promotion lanes

| Lane | Meaning | Allowed next step |
|---|---|---|
| `stay-in-review` | Fixture set is incomplete, unsafe, or ambiguous. | Revise the packet; do not calibrate. |
| `calibration-candidate` | Fixture set is public-safe and behavior-specific, but results are not yet measured. | Run local calibration with public-safe output only. |
| `threshold-candidate` | Calibration evidence exists and mismatches are resolved or documented. | Consider threshold tuning in observe/warn mode only. |
| `handoff-candidate` | Redacted outputs have been tested for downstream agent workflows. | Run handoff dry runs without raw visitor payloads. |
| `blocked` | Fixture set contains unsafe material or implies authority it does not have. | Stop and request human review. |

## Promotion checklist

A fixture set may move from review to `calibration-candidate` only when all checks pass:

- [ ] A fixture review packet exists and records the selected corpus id, version, reviewer, and proposed workflow mode.
- [ ] Every fixture has a stable id, category, expected lane, and public-safe expected flags.
- [ ] Every fixture tests one scanner behavior, or the combined behavior is explicitly justified.
- [ ] Every input is a redacted summary, not raw visitor text.
- [ ] No fixture includes decoded hidden text, suspicious live links, credentials, secret-looking values, private keys, seed phrases, wallet recipients, private routes, private config, payout details, model routes, billing routes, or execution payloads.
- [ ] High and critical fixtures require human review before downstream agent handoff.
- [ ] Expected public output can report only fixture id, category, lane, flags, and redacted reason.
- [ ] No fixture implies owner approval, signing authority, wallet authority, payout authority, publishing authority, outreach authority, paid-work acceptance, or access sharing.
- [ ] Hold/reject decisions are recorded with public-safe reasons.
- [ ] The next step is repo-local only.

## Hold checklist

Keep the fixture set in `stay-in-review` or `blocked` when any item is true:

- [ ] Raw hostile payloads or decoded hidden text are present.
- [ ] Suspicious live links, wallet recipients, credentials, secrets, or execution payloads are present.
- [ ] A fixture's expected lane would allow agent handoff for obfuscated relay, wallet-risk, credential-risk, urgent wallet rescue, unknown-recipient pressure, or approval-class requests.
- [ ] Failure output would expose unsafe content.
- [ ] The fixture set combines too many unrelated behaviors to explain a scanner mismatch.
- [ ] The packet asks the Action to approve, sign, spend, launch, claim, publish, contact outsiders, accept paid work, or share access.

## Promotion record template

```md
# Fixture Promotion Record

- Corpus id:
- Corpus version:
- Review packet:
- Promotion lane: stay-in-review / calibration-candidate / threshold-candidate / handoff-candidate / blocked
- Decision date:
- Reviewer:

## Decision summary

- Public-safe storage confirmed: yes / no
- Raw risky payloads copied: no
- Decoded hidden text copied: no
- Suspicious live links copied: no
- Credentials or secret-shaped values copied: no
- Wallet recipients copied: no
- Approval-class authority implied: no
- External commitment implied: no

## Required next step

- Next local action:
- Human review required before proceeding: yes / no
- Reason:

## Public-safe notes

- Keep:
- Revise:
- Reject:
- Open questions:
```

## Non-goals

This checklist does not publish a GitHub Action, create a marketplace listing, contact adopters, accept paid work, request wallet approval, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, share access, or mark any roadmap phase passed. It only defines a safe promotion boundary for repo-local scanner fixture testing.
