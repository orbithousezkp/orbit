# Intake Guardrail Action Adopter Readiness Matrix

## Cycle selection

This cycle compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action remains the active repo-local prototype, and adopters need a compact readiness matrix before rollout.
- **Earn**: relevant because clearer adoption readiness can support future use by other repos, but this cycle does not do outreach, marketplace listing, paid work, or external commitments.
- **Infrastructure**: useful because adoption readiness is part of Orbit's reusable control-plane surface, but this cycle should stay scoped to documentation and avoid already-dirty CLI files.
- **Sustain**: important because readiness must preserve wallet, signing, token, payout-route, and spend boundaries, but no approval-class movement is needed.
- **Grow**: useful because the matrix supports future developer-autopilot and visitor-community evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: add one public-safe adopter readiness matrix for the repo-local Intake Guardrail Action so maintainers can choose a rollout mode, permissions stance, review lane, and hold criteria before any gated publishing or outreach decision.

## Purpose

Use this matrix before installing or enabling `packages/issue-scam-scanner` in another repository. It is a readiness guide only. It does not publish the Action, contact adopters, accept paid work, request funds, grant access, spend treasury assets, sign transactions, launch or move tokens, claim rewards, or change payout routes.

## Readiness levels

| Level | Repository state | Recommended rollout mode | Required human review | Hold if |
| --- | --- | --- | --- | --- |
| 0 - Not ready | Maintainers have not reviewed the scanner purpose, outputs, or limits. | Do not enable. | Assign a maintainer to review docs first. | The repo expects autonomous enforcement, wallet action, or raw risky text handoff to agents. |
| 1 - Observe | The repo wants visibility without workflow side effects. | Run scan with read-only permissions and record a summary. | Review first 5 to 10 flagged events manually. | The workflow needs write permissions before a reviewer can justify them. |
| 2 - Warn | Maintainers want soft CI or issue warnings. | Emit warnings or summaries only. | Review quarantine/block recommendations before acting. | Public summaries would copy raw hostile payloads, decoded hidden text, private config, or wallet details. |
| 3 - Quarantine | The repo routes suspicious intake away from agents. | Stop agent handoff on quarantine or block. | Human review required before any agent receives the content. | The repo cannot separate redacted summaries from raw issue/comment content. |
| 4 - Enforce review | The repo has tested false positives and rollback. | Require maintainer review before continuing risky workflows. | Maintainer approval required for overrides. | Rollback path, override receipt, or failure handling is unclear. |

## Permission stance

Start with read-only GitHub permissions. Add write permissions only after a maintainer documents the exact side effect, such as adding a label or writing a check summary. The scanner output must not authorize spending, signing, token movement, reward claims, payout-route changes, publishing, outreach, paid commitments, or access sharing.

## Adoption receipt

```text
Repository: <owner/repo>
Candidate ref: <version, tag, branch, or commit>
Readiness level: 0 / 1 / 2 / 3 / 4
Rollout mode: disabled / observe / warn / quarantine / enforce-review
Permissions reviewed: yes/no
Human review lane assigned: yes/no
Raw risky payload copied into summaries: no
Agent handoff stops on quarantine or block: yes/no/not applicable
Override receipt required: yes/no
Rollback path documented: yes/no
Approval-class action involved: none
External commitment involved: none
Decision: hold / proceed with observe / proceed with warn / proceed with quarantine / proceed after fixes
Notes: <public-safe summary>
```

## Reviewer checklist

Before moving up a readiness level, confirm:

- Maintainers understand the scanner is an intake guardrail, not a full security product or autonomous authority.
- Workflow summaries use public-safe flags, scores, action names, and fixture ids instead of raw risky content.
- Quarantine and block outputs stop agent handoff by default.
- Scanner failures fail closed for agent handoff and do not leak raw input.
- Overrides are human-owned, receipt-backed, and cannot approve gated actions.
- Rollback is clear for labels, comments, checks, blocking behavior, and workflow disablement.

## Non-goals

This matrix does not publish the Action, create a marketplace listing, contact adopters, accept paid work, create an approval issue, spend funds, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, or mark a roadmap phase passed. It only helps a maintainer choose a conservative adoption level for the repo-local Intake Guardrail prototype.
