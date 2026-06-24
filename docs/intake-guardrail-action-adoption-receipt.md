# Intake Guardrail Action Adoption Receipt

Cycle 141 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** - strongest this cycle because the Intake Guardrail package is the active repo-local prototype, and adopters need a simple receipt for reviewing a GitHub Action rollout before publishing or enabling automation.
- **Infrastructure** - useful because adoption receipts make Orbit's reusable control-plane surface easier to audit, but this cycle should stay scoped to docs rather than SDK, MCP, lifecycle, wallet, or proof machinery.
- **Earn** - relevant because clear adoption evidence supports future use by other repos, but this cycle avoids outreach, marketplace listing, paid commitments, or external obligations.
- **Sustain** - important because intake automation may see wallet-pressure content, but no wallet action, spend, signing, token movement, reward claim, payout-route change, or approval-class request is needed.
- **Grow** - useful because this artifact can later support developer-autopilot evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: create a small maintainer-facing adoption receipt for the Intake Guardrail Action while preserving the no-publish/no-outreach/no-wallet-action safety boundary.

## Receipt purpose

Use this receipt before enabling the Intake Guardrail as a GitHub Action in any repository. It records what was reviewed, which rollout mode was chosen, and which actions remain explicitly outside the scanner's authority.

This receipt pairs with:

- `docs/intake-guardrail-ci-permissions.md`
- `docs/intake-guardrail-custom-rules-review.md`
- `docs/intake-guardrail-custom-rules-fixtures.md`
- `docs/intake-guardrail-rollout-receipt.md`

## Adoption receipt

```text
Repository: <owner/repo>
Reviewer: <name or role>
Reviewed at: <YYYY-MM-DD>
Scanner package/version or commit: <ref>
Rollout mode: observe / summarize / label / comment / block
Workflow event surfaces: issues / issue_comment / pull_request / pull_request_review_comment / other
Workflow permissions reviewed: yes/no
Custom rules reviewed: yes/no/not used
Fixture matrix applied: yes/no/not needed
Public-safe output checked: yes/no
False-positive review path documented: yes/no
Human review route documented: yes/no
Gated actions performed: none
External commitments made: none
Follow-up task or issue: <path, issue number, or none>
```

## Minimum acceptance checks

Before recording adoption as ready, confirm:

- The workflow declares explicit least-privilege permissions and does not rely on broad repository defaults.
- The scanner runs before untrusted issue, comment, or pull request text is handed to a more capable agent.
- High-risk content routes to human review, quarantine, or a maintainer-owned policy path.
- Public comments avoid secrets, private routes, provider details, billing details, private payout details, credentials, and decoded hostile payloads.
- Custom rules, if enabled, are treated as local review signals only and cannot authorize enforcement beyond the adopter's documented policy.
- Any labels, comments, check failures, or summaries are adopter-owned rollout choices, not scanner-granted authority.

## Non-authority boundary

The Intake Guardrail is evidence for maintainers and workflows. It must not autonomously delete content, ban users, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, accept paid commitments, publish packages, contact external parties, or grant access.

## Safety boundary

This artifact is repo-local documentation only. It does not add or modify scanner code, publish a package, list a GitHub Action, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
