# Intake Guardrail Action Release Checklist

## Cycle selection

This cycle compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action remains the active repo-local prototype, and a release checklist helps maintainers prepare without publishing.
- **Infrastructure**: useful because release readiness is part of a reusable repository control-plane surface, but this cycle should stay scoped to documentation rather than SDK, MCP, or lifecycle code.
- **Earn**: relevant because clearer release readiness can support future adoption, but this cycle avoids outreach, marketplace listing, paid commitments, or external obligations.
- **Sustain**: important because release workflows can accidentally expose authority or private details, but no wallet action, spend, signing, token movement, reward claim, payout-route change, or approval-class request is needed.
- **Grow**: useful because this artifact supports roadmap evidence for developer-autopilot maturity, but it does not mark any phase passed.

Selected direction: **build**. Reason: add one public-safe release-readiness checklist for the Intake Guardrail Action while preserving the no-publish, no-outreach, no-wallet-action safety boundary.

## Purpose

Use this checklist before preparing any public release, package publish, marketplace listing, or adopter handoff for the Intake Guardrail Action. It keeps release review focused on safe outputs, least privilege, maintainer authority, and rollback readiness.

This document is a preparation checklist only. Publishing, marketplace listing, outreach, paid commitments, external access, or any approval-class movement still requires owner direction and the relevant gate.

## Release readiness checks

| Area | Check | Ready signal |
| --- | --- | --- |
| Scope | The README and package metadata describe the tool as an intake guardrail, not an autonomous security authority. | Product copy says scanner output is advisory and maintainer-owned. |
| Permissions | Workflow examples use least-privilege GitHub permissions. | No broad write token is required for observe or summary modes. |
| Outputs | Action outputs are documented with safe downstream uses and forbidden uses. | Consumers know `allow`, `warn`, `quarantine`, `block`, and scanner-failure routing. |
| Redaction | Public summaries avoid raw hostile payloads, decoded hidden text, private config, credentials, and wallet routes. | Examples use fixture ids, flags, and short public-safe summaries. |
| Fixtures | Test fixtures are synthetic or redacted and do not contain secrets, live wallet details, or executable hostile instructions. | Fixture review receipt exists before release. |
| Thresholds | Default thresholds are conservative and documented with rollback criteria. | Quarantine and block results stop agent handoff by default. |
| Overrides | Maintainer override paths are explicit and receipt-backed. | Overrides cannot authorize spend, signing, publishing, outreach, or access sharing. |
| Failure modes | Scanner failure fails closed for agent handoff and avoids leaking raw input. | Timeout, malformed output, and unknown action handling are documented. |
| Adoption | An adoption receipt template exists for repository owners. | Maintainers can record rollout mode, permissions, review route, and follow-up. |
| Rollback | Release rollback criteria are documented before publication. | Maintainers know how to disable labels, comments, checks, or blocking behavior. |

## Pre-release receipt

```text
Release candidate ref: <version, tag, or commit>
Reviewer: <name or role>
Reviewed at: <YYYY-MM-DD>
Docs reviewed: yes/no
Workflow permissions reviewed: yes/no
Output map reviewed: yes/no
Fixture safety reviewed: yes/no
Threshold calibration reviewed: yes/no
Failure modes reviewed: yes/no
Override path reviewed: yes/no
Adoption receipt reviewed: yes/no
Raw risky payload copied into release docs: no
Approval-class action involved: none
External commitment involved: none
Publish/outreach approved: no/not requested
Rollback path documented: yes/no
Decision: hold / ready for owner review / ready after fixes
Notes: <public-safe summary>
```

## Owner-review questions

Before any public release or external listing, ask:

- Does the release copy avoid claiming that Orbit is a full security product or autonomous enforcement authority?
- Does the release keep all wallet, signing, token, payout-route, spending, publishing, and outreach actions outside scanner authority?
- Are examples safe for public repositories and free of secret-looking values, live recipient details, decoded hidden text, or private config?
- Is the first adopter path reversible, low-permission, and human-reviewed?
- Are known false-positive and false-negative risks documented without raw risky payloads?

## Non-goals

This checklist does not publish the Action, create a marketplace listing, contact adopters, accept paid work, spend funds, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, or create an approval issue. It only prepares a public-safe release review path for the repo-local Intake Guardrail prototype.
