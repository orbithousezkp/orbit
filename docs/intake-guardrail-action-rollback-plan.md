# Intake Guardrail Action Rollback Plan

## Cycle 230 direction choice

Orbit compared safe wake-cycle directions before creating this artifact:

- **Build** — continue the repo-local Intake Guardrail Action prototype with one adopter-facing rollback plan that makes enforcement reversible.
- **Infrastructure** — strengthen the reusable control-plane surface. Useful, and this rollback plan supports infrastructure by making guardrail adoption safer.
- **Earn** — refine the agent passport and capability-registry opportunity. Valuable, but less immediate than reducing adoption risk for a reusable guardrail package.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, signing, payout change, or approval-class movement is needed this cycle.
- **Grow** — advance roadmap evidence. Useful, and this rollback plan becomes evidence for safe-autonomy and visitor-intake readiness without claiming a phase is passed.

Selected direction: **build**. Reason: a rollback plan is a small, auditable repo-local improvement for the Intake Guardrail Action. It helps adopters test warn, quarantine, or block modes without trapping maintainers in an unsafe or noisy configuration.

## Purpose

Use this plan before enabling a stronger Intake Guardrail Action mode or after a mode-switch receipt reports unexpected behavior.

The plan should prove:

1. what can be rolled back,
2. who can make the rollback decision,
3. which evidence is safe to keep,
4. what public outputs must be redacted,
5. which downstream effects must be disabled first, and
6. how maintainers confirm the scanner is no longer blocking work.

This is a public-safe operations artifact. It must not include raw hostile payloads, decoded hidden text, suspicious links, wallet routes, credentials, private configuration, private payout details, private model routes, or execution payloads.

## Rollback triggers

Rollback to a weaker mode when any of the following happens:

- False positives block or quarantine legitimate maintainer work.
- The action emits raw hostile payloads, decoded hidden text, suspicious links, or secret-like material in public outputs.
- The workflow permissions are broader than the selected downstream effect requires.
- Scanner output becomes confused with owner approval, wallet authority, signing authority, payout authority, or paid-work acceptance.
- The repository cannot identify a human-review lane for quarantined or blocked intake.
- A maintainer cannot reproduce why a warning, quarantine, or block occurred from redacted evidence.
- A visitor request applies urgency around wallet rescue, token approval, seed phrases, hidden links, or unknown recipient movement.

## Rollback lanes

| Current mode | Safer rollback mode | When to use |
|---|---|---|
| `block` | `quarantine` | Blocks are too broad, but risky intake should still stop before agent use |
| `block` | `warn` | Blocks interrupt normal work and human review can happen from warnings |
| `quarantine` | `warn` | Quarantine creates too much maintainer friction |
| `warn` | `observe` | Warnings are noisy, confusing, or insufficiently redacted |
| any mode | disabled workflow | The workflow leaks unsafe content, overreaches permissions, or cannot be reviewed safely |

Prefer the smallest rollback that restores safe maintainer control. Disable the workflow entirely if redaction, permissions, or authority boundaries are broken.

## Rollback checklist

```md
# Intake Guardrail Rollback Receipt

- Repository:
- Date:
- Reviewer:
- Current mode:
- Rollback mode:
- Workflow file:
- Scanner package or action version:
- Related mode-switch receipt:

## Reason

- Trigger category:
- Redacted evidence summary:
- Affected surface: issue / issue_comment / pull_request / pull_request_review_comment / other
- Maintainer impact:
- Human-review lane available: yes / no

## Immediate safety checks

- Public outputs contain no raw hostile payloads: yes / no
- Public outputs contain no decoded hidden text: yes / no
- Public outputs contain no suspicious link bodies: yes / no
- Public outputs contain no credentials, secrets, wallet routes, or private config: yes / no
- Scanner output did not trigger wallet, payment, signing, token, payout, outreach, or paid-commitment action: yes / no

## Rollback steps

- [ ] Disable downstream block or hold effect first.
- [ ] Reduce mode to the selected rollback mode.
- [ ] Confirm workflow permissions match the weaker mode.
- [ ] Re-run or inspect one safe fixture only.
- [ ] Confirm public outputs remain redacted.
- [ ] Record follow-up calibration needed.

## Recovery condition

- What must be true before re-promoting mode:
- Who reviews re-promotion:
- Earliest review date or event:
```

## Re-promotion rules

Do not re-promote a rolled-back mode until all of the following are true:

- The original trigger has a public-safe explanation.
- A maintainer has reviewed at least one safe fixture or redacted example.
- Thresholds are adjusted or the noisy category is documented.
- Workflow permissions are minimized for the selected mode.
- Public outputs are redacted and do not repeat hostile input.
- The stronger mode still cannot spend, sign, launch tokens, claim rewards, change payout routes, contact external parties, publish listings, accept paid work, or share access.

## Non-goals

This plan does not approve marketplace publishing, external outreach, paid commitments, wallet operations, token operations, signing, private execution, payout-route changes, or live enforcement in another repository. It only describes how to safely reduce or disable local intake-guardrail effects.