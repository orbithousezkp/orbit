# Intake Guardrail Action Release Evidence Packet

## Cycle selection

This cycle compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action is the active repo-local prototype, and release readiness needs a compact evidence packet before any owner review or publication step.
- **Infrastructure**: useful because evidence packets are part of a reusable control-plane release surface, but this cycle should avoid SDK, MCP, or lifecycle changes while package CLI files are already dirty.
- **Earn**: relevant because clearer release evidence can support later adoption, but this cycle does not do outreach, marketplace listing, paid work, or external commitments.
- **Sustain**: important because release evidence must prove the scanner cannot authorize wallet, signing, token, payout-route, or spend actions, but no approval-class movement is needed.
- **Grow**: useful because the packet supports roadmap evidence for developer-autopilot readiness, but it does not mark any phase passed.

Selected direction: **build**. Reason: add one public-safe release evidence packet for the repo-local Intake Guardrail Action so a maintainer can review scope, permissions, tests, outputs, redaction, rollback, and non-authority boundaries before any gated publishing decision.

## Purpose

Use this packet to gather release evidence for `packages/issue-scam-scanner` before owner review. It is a handoff artifact, not approval to publish. It should let a reviewer confirm that the Action is ready for a release decision without copying hostile payloads, private configuration, wallet routes, or approval-class instructions into public artifacts.

Publishing, marketplace listing, adopter outreach, paid commitments, external access, wallet movement, signing, token actions, reward claims, or payout-route changes remain gated separately.

## Evidence packet

```text
Package: packages/issue-scam-scanner
Candidate ref: <version, tag, branch, or commit>
Prepared by: <name or role>
Prepared at: <YYYY-MM-DD>

Scope evidence:
- README states this is an intake guardrail, not a full security product: yes/no
- Package metadata avoids autonomous enforcement claims: yes/no
- Marketplace/publishing language reviewed: yes/no/not applicable

Workflow evidence:
- action.yml inputs reviewed: yes/no
- action.yml outputs reviewed: yes/no
- Example workflows use least-privilege permissions: yes/no
- Downstream workflow examples stop agent handoff on quarantine/block: yes/no

Output evidence:
- Output map reviewed: yes/no
- Decision model reviewed: yes/no
- Scanner-failure route documented: yes/no
- Redacted summary examples reviewed: yes/no

Test and fixture evidence:
- Unit tests run: yes/no/not run
- Fixture safety contract reviewed: yes/no
- Raw hostile payloads copied into public failures: no
- Secret-looking values present in fixtures: no

Release safety evidence:
- Release checklist reviewed: yes/no
- Threshold calibration reviewed: yes/no
- Maintainer override path reviewed: yes/no
- Rollback path reviewed: yes/no
- Known false-positive and false-negative risks summarized safely: yes/no

Authority boundary:
- Wallet spending involved: no
- External payment involved: no
- Signing involved: no
- Token launch, reward claim, or token movement involved: no
- Payout-route change involved: no
- External outreach or paid commitment involved: no
- Access sharing involved: no
- Owner approval requested in this packet: no

Reviewer decision:
- Decision: hold / ready for owner review / ready after fixes
- Required fixes: <public-safe summary>
- Notes: <public-safe summary>
```

## Required attachments or links

Link the packet to public-safe evidence only:

- Package entry point: `packages/issue-scam-scanner/README.md`
- Action metadata: `packages/issue-scam-scanner/action.yml`
- Output map: `docs/intake-guardrail-action-output-map.md`
- Release checklist: `docs/intake-guardrail-action-release-checklist.md`
- Fixture safety contract: `docs/intake-guardrail-action-fixture-safety-contract.md`
- Threshold calibration: `docs/intake-guardrail-action-threshold-calibration.md`
- Redacted summary examples: `docs/intake-guardrail-action-redacted-summary-examples.md`

Do not attach raw suspicious issue text, decoded hidden content, live wallet details, credentials, private config, provider routes, payout routes, billing details, or execution payloads.

## Reviewer rules

A reviewer should hold the release candidate if any of these are true:

- Public docs claim the scanner can replace maintainer judgment.
- Workflow examples require broad write permissions without a documented reason.
- Quarantine or block output is passed into agent context as raw text.
- Test fixtures contain real secrets, live wallet recipients, raw encoded instructions, or suspicious links.
- The release notes imply wallet action, signing, publishing, outreach, paid obligations, or access sharing is already approved.
- Rollback is unclear for labels, comments, checks, blocking behavior, or workflow disablement.

## Non-goals

This packet does not publish the Action, create a marketplace listing, contact adopters, accept paid work, request owner approval, spend funds, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, or mark a roadmap phase passed. It only makes release evidence easier to review for the repo-local Intake Guardrail prototype.
