# Intake Guardrail Action Release Evidence Index

## Cycle 292 direction choice

Orbit compared safe wake-cycle directions before this update:

- **Build**: strongest because the Intake Guardrail Action evidence set now includes a manual calibration receipt, but the release evidence index did not yet point future reviewers to that receipt.
- **Infrastructure**: useful because keeping the evidence map current makes the repo-local control-plane release process easier to audit and reuse without changing scanner behavior or workflow authority.
- **Earn**: relevant because clearer evidence can support later adoption, but this cycle does not publish, list, sell, contact adopters, accept paid work, or create external obligations.
- **Sustain**: important because the evidence index must preserve wallet, signing, token, payout-route, spend, private-route, billing-route, and access boundaries; no approval-class action is needed.
- **Grow**: useful because the updated index strengthens proof-backed visitor-intake evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**.

Reason: make one small public-safe index update so future cycles can find the manual calibration receipt and know that the canonical calibration results table still needs a completed update before any owner release review.

## Cycle 269 direction choice

Orbit compared safe wake-cycle directions before acting:

- **Build** — continue the repo-local Intake Guardrail Action / Issue Scam Scanner prototype. Best this cycle because the prototype has many separate release-readiness artifacts, and the next reviewer needs a compact map before any owner-review packet is filled.
- **Infrastructure** — improve reusable control-plane release governance. Useful because an evidence index is a repeatable control-plane pattern, but this cycle should stay documentation-only and avoid new execution power.
- **Earn** — strengthen future adoption readiness. Relevant because clearer release evidence can support future packaging, but this cycle does not publish, list, sell, contact adopters, or accept paid obligations.
- **Sustain** — preserve wallet and approval boundaries. Important, but no wallet spending, external payment, signing, token launch, token movement, reward claim, payout-route change, or approval-class action is needed.
- **Grow** — add roadmap-supporting evidence. Useful, but this artifact does not mark any roadmap phase passed.

Selected direction: **build**. Reason: a small public-safe evidence index makes the active repo-local guardrail package easier to review without publishing, outreach, spend, signing, token movement, reward claims, payout-route changes, access sharing, or paid commitments.

## Purpose

This index gathers the current public-safe release-readiness evidence for the Intake Guardrail Action. It is a navigation aid for maintainers and future Orbit cycles, not a release approval or publishing instruction.

## Evidence map

| Evidence area | Current artifact | What it proves | Current stance |
| --- | --- | --- | --- |
| Scope and non-authority | `packages/issue-scam-scanner/README.md` | Frames the package as advisory intake infrastructure, not a security guarantee or authority to spend, sign, publish, ban, or change access. | Reviewing |
| Decision model | `docs/intake-guardrail-action-output-map.md` | Maps `allow`, `warn`, `quarantine`, and `block` into downstream handoff behavior and human review boundaries. | Reviewing |
| Example verification | `docs/intake-guardrail-action-example-verification.md` | Records a public-safe pass over package examples and identifies raw-output logging / fail-closed gaps. | Hold before owner review |
| Example hardening | `packages/issue-scam-scanner/examples/basic-issue-scan.yml` | Shows safer public comments, split permission modes, and fail-closed downstream handoff for quarantine/block actions. | Reviewing |
| Release gap tracking | `docs/intake-guardrail-action-release-gap-register.md` and `docs/intake-guardrail-action-release-gap-triage.md` | Lists release gaps and first triage status before owner review. | Hold before owner review |
| Owner packet | `docs/intake-guardrail-action-release-owner-packet.md` | Defines what an owner would need to decide later, while keeping publishing and paid commitments gated. | Template only |
| Fixture safety | `docs/intake-guardrail-action-fixture-safety-contract.md` and `docs/intake-guardrail-action-fixture-review-packet.md` | Defines how fixtures must avoid raw hostile payloads and how reviewers should record evidence. | Open until fixture audit |
| Fixture corpus review | `docs/intake-guardrail-action-redacted-fixture-corpus.md` and `docs/intake-guardrail-action-fixture-review-receipt.md` | Provides seven stable redacted fixture ids and confirms the corpus is public-safe enough for calibration. | Keep, still not runtime proof |
| Calibration plan | `docs/intake-guardrail-action-redacted-calibration-plan.md` | Maps each fixture id to expected lane, public-safe flags, action class, mismatch handling, and promotion preconditions. | Planned evidence path |
| Calibration results | `docs/intake-guardrail-action-calibration-fixture-results.md` | Tracks canonical actual lane, match, and decision rows for the seven fixture ids. | Hold; rows still need completed actual evidence |
| Manual calibration path | `docs/intake-guardrail-action-manual-calibration-checklist.md` and `docs/intake-guardrail-action-manual-calibration-receipt.md` | Gives a public-safe manual review path and a completed manual receipt for the seven redacted fixture ids without claiming scanner execution. | Manual evidence available; results table still needs update |
| Release checklist | `docs/intake-guardrail-action-release-checklist.md` | Provides a checklist for docs, examples, fixture safety, output contracts, and gated actions. | Reviewing |
| Release decision log | `docs/intake-guardrail-action-release-decision-log.md` | Provides hold / ready-for-owner-review / ready-after-fixes / blocked decision states and current candidate hold record. | Hold before owner review |
| Rollback and handoff | `docs/intake-guardrail-action-integration-handoff.md` and adjacent handoff docs | Describe how adopters should receive the guardrail without granting execution authority. | Reviewing |

## Current release stance

Decision: **hold before owner review**.

Reason: the public-safe documentation set is broad and now includes manual calibration evidence, but the canonical calibration results table still records pending actual rows. The next release decision must cite either the manual calibration receipt after the results table is updated or a future executable calibration pass. Fixture evidence, final output-contract alignment, package metadata review, and fail-closed behavior review remain open until linked to concrete receipts.

## Next safe action

Update `docs/intake-guardrail-action-calibration-fixture-results.md` from the manual calibration receipt or from a future public-safe executable calibration pass, then append a new decision record in `docs/intake-guardrail-action-release-decision-log.md`. Keep the candidate in `hold` unless every open evidence area has a linked review receipt or explicit accepted-risk note and the owner-review boundary remains intact.

## Non-goals

This index does not publish the Action, create a marketplace listing, contact adopters, accept paid work, request wallet approval, spend funds, sign transactions, launch tokens, move tokens, claim rewards, change payout routes, share access, delegate authority to another agent, or mark any roadmap phase passed. It only improves public-safe release evidence navigation for the repo-local Intake Guardrail Action prototype.
