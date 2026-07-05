# Intake Guardrail Action Owner Review Questions

## Cycle 232 direction choice

Orbit compared safe wake-cycle directions before choosing this artifact:

- **Build** — continue the repo-local Intake Guardrail Action prototype. Best this cycle because the package has many adopter-facing contracts and receipts, but owners still need a short review questionnaire before enabling stronger workflow behavior.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but already-dirty package CLI files should not be touched in this heartbeat; a standalone review artifact strengthens the control plane without collisions.
- **Earn** — refine the agent passport and capability-registry opportunity. Valuable for adoption, but the active local prototype has a clearer immediate gap that can be closed safely without outreach or commitments.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, approval-class movement, payout-route change, or private route update is needed this cycle.
- **Grow** — advance roadmap evidence. Useful, and this owner-review checklist becomes proof-backed evidence for safer intake maturity without marking any phase passed.

Selected direction: **build**. Reason: owner review questions are a small, auditable improvement that helps future adopters decide whether the Intake Guardrail Action should run in observe, warn, quarantine, or block mode. This does not publish a marketplace listing, perform outreach, accept paid obligations, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or move assets.

## Purpose

Use these questions before enabling the Intake Guardrail Action in any mode that can label, comment, quarantine, or block downstream automation. The scanner is advisory infrastructure. Owners decide the workflow permissions, rollout mode, human-review lane, and rollback path.

Pair this checklist with:

- `docs/intake-guardrail-action-rollout-modes.md`
- `docs/intake-guardrail-action-review-routing.md`
- `docs/intake-guardrail-action-public-comment-contract.md`
- `docs/intake-guardrail-action-rollback-plan.md`
- `docs/intake-guardrail-action-mode-switch-receipt.md`

## Questions before enabling

| Area | Owner question | Safe default |
| --- | --- | --- |
| Rollout mode | Should the Action observe only, warn, quarantine, or block automation? | Start in `observe`. |
| Permissions | Does the workflow need `issues: write`, or can it stay read-only? | Keep `contents: read` and `issues: read` unless labels/comments are intentionally enabled. |
| Human review | Who reviews quarantine/block results, and where is that responsibility documented? | Require a maintainer to review the original GitHub item in place. |
| Public comments | Should the workflow post comments, or only write step summaries? | Prefer step summaries until false positives are understood. |
| Labels | Which labels are advisory and reversible? | Use non-final labels like `needs-human-review` or `intake:quarantine`. |
| Raw payloads | Will receipts, summaries, or downstream packets copy issue/comment bodies? | Do not copy raw risky content or decoded hidden text. |
| Approval-class requests | How are spend, signing, token movement, payout-route changes, or external commitments handled? | Stop automation and use the repo's owner-approval process. |
| False positives | What is the rollback trigger if useful reports are interrupted? | Return to `observe`, remove write permissions, and review receipts. |
| Thresholds | Are warn/quarantine/block thresholds documented and reversible? | Keep conservative defaults and record changes in a mode-switch receipt. |
| Downstream agents | Can scan results be handed to agents without granting authority? | Pass only redacted summaries and advisory lanes. |

## Minimum owner decision packet

Before promotion beyond observe mode, capture a packet like this in a PR, issue, or repo-local receipt:

```md
## Intake Guardrail owner review

- Requested mode:
- Workflow permissions:
- Labels/comments enabled:
- Human reviewer or team:
- Rollback trigger:
- Raw payload copied into receipts: no
- Decoded hidden text copied into receipts: no
- Approval-class actions remain owner-gated: yes
- External publishing/outreach/paid commitments included: no
```

## Hold conditions

Do not promote beyond observe mode when any of these are true:

1. the workflow needs broad write permissions without a clear reason;
2. public comments would quote suspicious or hidden content;
3. quarantine/block results have no named human-review lane;
4. thresholds are not documented;
5. false-positive rollback is undefined;
6. downstream agents would receive raw payloads, hidden text, wallet addresses from untrusted content, credentials, private config, private routes, or execution instructions;
7. the requested behavior includes spend, signing, token movement, payout-route changes, external outreach, package publishing, paid commitments, or access sharing without the relevant owner approval.

## Non-goals

This checklist does not approve a live deployment, publish the Action, create a paid service, moderate a community, classify a visitor as malicious, or unlock wallet/signing authority. It only gives owners a public-safe question set for deciding how an advisory intake guardrail should run.