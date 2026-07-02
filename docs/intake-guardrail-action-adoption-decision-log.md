# Intake Guardrail Action Adoption Decision Log

## Cycle selection

This cycle compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action is the active repo-local prototype, and the existing readiness matrix needs a small decision-record companion for maintainers.
- **Earn**: relevant because clearer adoption records make the guardrail easier for future repos to evaluate, but this cycle does not do outreach, marketplace listing, paid work, or external commitments.
- **Infrastructure**: useful because adoption decisions become part of Orbit's reusable control-plane pattern, but the change should stay in documentation and avoid already-dirty package CLI files.
- **Sustain**: important because decision records must preserve wallet, signing, token, payout-route, and spend boundaries, but no approval-class action is involved.
- **Grow**: useful because the log can support future visitor-community or developer-autopilot evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: add one public-safe adoption decision log so maintainers can record rollout choices, review owners, safety holds, and rollback status before any gated publishing, outreach, or paid-work decision.

## Purpose

Use this log when deciding whether to adopt or advance `packages/issue-scam-scanner` in a repository. The log is a public-safe receipt template for human review. It does not install the Action, publish a marketplace listing, contact adopters, accept paid work, grant access, spend funds, sign transactions, launch or move tokens, claim rewards, or change payout routes.

## Decision record

```text
Date: <YYYY-MM-DD>
Repository: <owner/repo>
Candidate ref: <tag, branch, commit, or local path>
Previous rollout mode: disabled / observe / warn / quarantine / enforce-review / not applicable
Proposed rollout mode: disabled / observe / warn / quarantine / enforce-review
Decision: hold / proceed / rollback / needs owner review
Decision owner: <maintainer or team>
Review lane: maintainer-review / security-review / agent-handoff-review / release-review
Public-safe reason: <short summary without raw risky payloads>
Evidence reviewed: <docs, fixtures, workflow summaries, tests, or receipts>
Permissions stance: read-only / write-limited / blocked pending review
Agent handoff behavior: allowed / stopped on quarantine-or-block / not applicable
Override policy reviewed: yes/no/not applicable
Rollback path reviewed: yes/no
Raw risky payload copied: no
Approval-class action involved: none
External commitment involved: none
Follow-up: <next local repo task or hold reason>
```

## Hold rules

Hold the adoption decision if any of these are true:

- The workflow would expose raw hostile text, decoded hidden content, private config, secret-like values, wallet details, or visitor-provided recipient data in public output.
- The scanner result would authorize spending, signing, token movement, reward claims, payout-route changes, publishing, outreach, paid commitments, or access sharing.
- The repository cannot stop agent handoff on quarantine or block results.
- Maintainers cannot identify who owns review, override, and rollback decisions.
- The permissions request is broader than the documented side effect.
- The candidate ref is not pinned or otherwise reviewable.

## Promotion checklist

Before promoting to a stronger rollout mode, confirm:

- The previous mode ran long enough to expose false positives and scanner failures.
- Maintainers reviewed representative summaries without copying raw risky input into public surfaces.
- Quarantine and block outcomes route to humans before agents receive the content.
- Override receipts are redacted, human-owned, and cannot approve gated actions.
- Rollback can disable labels, comments, checks, blocking behavior, or the workflow itself.
- The decision record stays inside repo-local review and does not create external obligations.

## Non-goals

This log does not publish the Action, create a marketplace listing, contact adopters, accept paid work, create an approval issue, spend treasury assets, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, or mark a roadmap phase passed. It only records public-safe human adoption decisions for the repo-local Intake Guardrail prototype.
