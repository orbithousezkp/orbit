# Intake Guardrail Action Release Gap Register

## Cycle 242 direction choice

Orbit compared safe wake-cycle directions before acting:

- **Build** — continue the repo-local Intake Guardrail Action / Issue Scam Scanner prototype with a small release-gap register that helps a maintainer track what is still missing before owner review.
- **Infrastructure** — improve the reusable control-plane release surface. Useful, because gap registers make Orbit's release readiness auditable, but this cycle should stay as documentation rather than new execution power.
- **Earn** — strengthen future adoption readiness. Relevant, because clearer release gaps can support later packaging, but this cycle does not do outreach, marketplace listing, paid work, or external commitments.
- **Sustain** — preserve wallet and approval boundaries. Important, but no wallet spending, external payment, signing, token launch, token movement, reward claim, payout-route change, or approval-class action is needed.
- **Grow** — add roadmap-supporting evidence. Useful, but this gap register does not mark a phase passed.

Selected direction: **build**. Reason: the active learning-lab prototype remains the Issue Scam Scanner / Intake Guardrail Action, and a release-gap register is a small auditable artifact that connects existing release evidence to the remaining human-review questions without publishing, outreach, spend, signing, token movement, reward claims, payout-route changes, access sharing, or paid commitments.

## Purpose

Use this register to track release-readiness gaps after filling the release checklist, evidence packet, review brief, decision log, and owner packet. It is meant to prevent a candidate from looking ready just because documents exist.

This register is not an approval request and does not authorize a release. It records public-safe gaps, owners, evidence links, and hold criteria before any owner review, marketplace listing, adopter handoff, or external commitment is considered.

## Gap states

| State | Meaning | Release implication |
| --- | --- | --- |
| `open` | A required evidence item, safety check, or decision is missing or stale. | Hold release review. |
| `reviewing` | A maintainer is checking the evidence or proposed fix. | Hold release review unless explicitly scoped to documentation only. |
| `fixed-needs-receipt` | The repo-local fix exists but has not been linked to a public-safe receipt. | Hold until receipt is linked. |
| `accepted-risk` | A maintainer accepts a known limitation with rollback or monitoring notes. | Can proceed only if the owner packet names the risk. |
| `closed` | The gap is resolved and linked to evidence. | No release hold from this gap. |
| `blocked` | The gap depends on approval-class action, private access, publishing, external commitment, or owner-only decision. | Stop and route through the relevant owner gate. |

## Gap register template

```text
Gap id: IGA-GAP-<number>
State: open / reviewing / fixed-needs-receipt / accepted-risk / closed / blocked
Area: scope / permissions / outputs / redaction / fixtures / thresholds / overrides / failure-modes / rollback / docs / tests / owner-decision
Found by: <name or role>
Found at: <YYYY-MM-DD>
Candidate ref: <branch, commit, tag, package path, or workflow path>

Public-safe gap summary:
- <short summary without raw hostile payloads, decoded hidden text, suspicious links, credentials, wallet recipients, or private config>

Why it matters:
- <what could go wrong for maintainers, downstream agents, public comments, labels, checks, or release review>

Evidence links:
- Checklist: <path or missing>
- Evidence packet: <path or missing>
- Review brief: <path or missing>
- Decision log: <path or missing>
- Owner packet: <path or missing>
- Test or fixture evidence: <path or missing>

Required safe fix:
- <repo-local documentation, test, fixture, workflow, or package change>

Hold trigger:
- <condition that keeps release review on hold>

Closure receipt:
- Closed by: <name or role>
- Closed at: <YYYY-MM-DD>
- Evidence link: <path, commit, receipt, or review packet>
- Raw risky payload copied: no
- Approval-class action involved: none
- External commitment involved: none
```

## Default gaps to check before owner review

A maintainer should create or verify gap entries for these items before marking a release candidate `ready for owner review`:

1. **README scope gap** — package copy must describe the tool as an intake guardrail and advisory routing signal, not a full security product or autonomous enforcement authority.
2. **Workflow permission gap** — example workflows must use least-privilege permissions for observe or summary modes.
3. **Output contract gap** — every GitHub Action output used by examples must be documented and mapped to safe downstream behavior.
4. **Redaction gap** — public examples must avoid raw hostile payloads, decoded hidden text, suspicious links, credentials, wallet details, and private config.
5. **Fixture safety gap** — fixtures must be synthetic or redacted and reviewed before release evidence cites them.
6. **Threshold gap** — quarantine and block thresholds must stop downstream agent handoff by default.
7. **Override gap** — maintainer overrides must be receipt-backed and unable to authorize spend, signing, publishing, outreach, access sharing, token movement, reward claims, or payout-route changes.
8. **Failure-mode gap** — scanner failures, malformed output, and timeout behavior must fail closed for downstream agent handoff without leaking raw input.
9. **Rollback gap** — maintainers must know how to disable labels, comments, checks, blocking behavior, and workflow entry points.
10. **Owner packet gap** — the owner packet must name all accepted risks and avoid implying any gated action is already approved.

## Hold conditions

Keep the release candidate on hold if any gap is open or blocked for:

- broad workflow permissions without justification;
- raw visitor content or decoded hidden text in public artifacts;
- suspicious links, credentials, wallet recipients, private config, provider routes, payout routes, billing details, access tokens, or execution payloads;
- examples that pass quarantined or blocked text directly into an agent;
- release copy that claims security guarantees or maintainer replacement;
- unclear rollback for comments, labels, checks, blocking behavior, or workflow disablement;
- any dependency on publishing, marketplace listing, outreach, paid work, access sharing, wallet spending, external payment, signing, token launch, token movement, reward claim, or payout-route change.

## Non-goals

This register does not publish the Action, create a marketplace listing, contact adopters, accept paid work, request wallet approval, spend funds, sign transactions, launch tokens, move tokens, claim rewards, change payout routes, share access, delegate authority to another agent, or mark any roadmap phase passed. It only tracks public-safe release-readiness gaps for the repo-local Intake Guardrail Action prototype.
