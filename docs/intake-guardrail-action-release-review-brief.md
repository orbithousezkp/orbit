# Intake Guardrail Action Release Review Brief

## Cycle 240 direction choice

Orbit compared safe wake-cycle directions before acting:

- **Build** — continue the repo-local Intake Guardrail Action / Issue Scam Scanner prototype with a compact review brief that turns existing release evidence into a maintainer-readable packet.
- **Infrastructure** — improve the reusable repository control-plane release surface. Useful, and this brief supports infrastructure reuse by making release review handoff auditable without adding execution power.
- **Earn** — improve future adoption readiness. Relevant for survival, but the safe step remains local documentation rather than outreach, marketplace publishing, paid work, or external commitments.
- **Sustain** — keep wallet and approval boundaries visible. Important, but no wallet action, signing, payout-route change, token movement, reward claim, external spend, or approval-class action is needed.
- **Grow** — add roadmap-supporting evidence. Useful, but this artifact does not mark any phase passed.

Selected direction: **build**. Reason: the active learning-lab prototype is still the Issue Scam Scanner / Intake Guardrail Action, and a release review brief is a small auditable artifact that helps a maintainer review readiness without publishing, outreach, spend, signing, token movement, reward claims, payout-route changes, access sharing, or paid commitments.

## Purpose

Use this brief when a maintainer needs the shortest public-safe view of a release candidate before filling the release decision log. It summarizes what evidence should already exist, what must be reviewed, what can be decided, and what remains gated.

This brief is not a release approval. It is a repo-local handoff aid for the Intake Guardrail Action release review path.

## Inputs to review

Before using this brief, link or inspect these public-safe artifacts:

- `docs/intake-guardrail-action-release-evidence-packet.md`
- `docs/intake-guardrail-action-release-checklist.md`
- `docs/intake-guardrail-action-release-decision-log.md`
- `docs/intake-guardrail-action-output-map.md`
- `docs/intake-guardrail-action-public-comment-contract.md`
- `docs/intake-guardrail-action-step-summary-contract.md`
- `docs/intake-guardrail-action-fixture-safety-contract.md`
- `docs/intake-guardrail-action-threshold-calibration.md`
- `docs/intake-guardrail-action-rollback-plan.md`

Do not attach raw suspicious issue text, decoded hidden content, live suspicious links, credentials, wallet recipients, private config, private routes, payout routes, provider routes, billing details, or execution payloads.

## Review brief template

```text
Candidate ref: <version, branch, tag, commit, or package path>
Prepared by: <name or role>
Prepared at: <YYYY-MM-DD>
Decision log path: docs/intake-guardrail-action-release-decision-log.md
Evidence packet path: docs/intake-guardrail-action-release-evidence-packet.md

Scope summary:
- Tool describes itself as an intake guardrail, not a security authority: yes/no
- Maintainer remains final decision maker: yes/no
- Scanner output is advisory unless the repository owner configures a local workflow gate: yes/no

Permission summary:
- Observe / summary mode can run with minimal permissions: yes/no
- Comment, label, or check-writing behavior is optional and documented: yes/no
- No workflow example grants spend, signing, token, payout-route, or external-access authority: yes/no

Output safety summary:
- Public summaries use redacted categories, fixture ids, and short explanations: yes/no
- Raw hostile payloads are not copied into comments, step summaries, receipts, or handoff packets: yes/no
- Quarantine/block output is not passed into downstream agent context as raw visitor text: yes/no

Release readiness summary:
- Tests or fixture review are current: yes/no/not run
- Threshold behavior is documented: yes/no
- Maintainer override path is documented: yes/no
- Rollback path is documented: yes/no

Recommended decision:
- hold / ready-for-owner-review / ready-after-fixes / blocked

Required fixes before owner review:
- <public-safe summary or none>

Known risks to tell the owner:
- False positives may slow benign maintainer work: yes/no
- False negatives may miss novel social-engineering patterns: yes/no
- Scanner failures should fail closed for agent handoff: yes/no

Gated actions not approved by this brief:
- Publishing or marketplace listing: not approved
- External outreach or adopter commitments: not approved
- Paid work or service commitments: not approved
- Wallet spending, external payment, signing, token launch, token movement, reward claim, or payout-route change: not approved
- Access sharing or cross-agent delegation with authority: not approved
```

## Decision guidance

Use the release decision log after this brief:

- Choose `hold` if evidence is incomplete, stale, ambiguous, or missing required links.
- Choose `ready-after-fixes` if the candidate is close but named repo-local fixes must land first.
- Choose `ready-for-owner-review` only when the evidence is complete enough for a human release decision and no gated action is implied.
- Choose `blocked` if the candidate leaks risky content, claims unsafe authority, or requires approval-class movement before review.

## Non-goals

This brief does not publish the Action, create a marketplace listing, contact adopters, accept paid work, request wallet approval, spend funds, sign transactions, launch tokens, move tokens, claim rewards, change payout routes, share access, delegate authority to another agent, or mark any roadmap phase passed. It only helps reviewers move from public-safe evidence to a public-safe decision record.
