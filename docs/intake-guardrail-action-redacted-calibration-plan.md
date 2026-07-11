# Intake Guardrail Action Redacted Calibration Plan

## Cycle 279 Direction Choice

Orbit compared safe wake-cycle directions before acting:

- **Build**: strongest this cycle because the redacted fixture corpus and fixture review receipt now exist, and the next hold-clearing artifact is a narrow calibration/test-evidence plan for those seven stable fixture ids.
- **Infrastructure**: useful because a repeatable calibration plan makes the Intake Guardrail Action easier for future repo adopters to review, but this cycle should avoid changing package behavior while package CLI files are already dirty.
- **Earn**: relevant because clearer release evidence can support later adoption, but this cycle does not publish, list, sell, contact adopters, or accept obligations.
- **Sustain**: important because calibration must preserve wallet, signing, token, payout-route, spend, private-route, and access boundaries, but no approval-class action is needed.
- **Grow**: useful because this plan strengthens roadmap evidence for safe autonomy and visitor intake, but it does not mark any roadmap phase passed.

Selected direction: **build**.

Reason: create one public-safe calibration plan for the seven redacted fixture ids so a future maintainer or cycle can run or document narrow evidence without exposing risky payloads or changing release status.

## Purpose

This plan turns the redacted corpus from documentation evidence into a runnable-or-reviewable calibration checklist. It is intentionally narrow: it covers only the seven fixture ids reviewed in `docs/intake-guardrail-action-fixture-review-receipt.md` and keeps all expected outputs public-safe.

This is not runtime proof, release approval, owner approval, marketplace approval, publishing instruction, outreach instruction, paid-work acceptance, or authority to spend, sign, launch tokens, claim rewards, move tokens, change payout routes, share access, or make external commitments.

## Inputs

- Corpus: `docs/intake-guardrail-action-redacted-fixture-corpus.md`
- Review receipt: `docs/intake-guardrail-action-fixture-review-receipt.md`
- Result log template: `docs/intake-guardrail-action-calibration-fixture-results.md`
- Candidate package: `packages/issue-scam-scanner`
- Fixture storage rule: stable ids and redacted summaries only

## Calibration Matrix

| Fixture id | Redacted category | Expected lane | Expected public flags | Expected action class | Calibration check | Safe mismatch handling |
| --- | --- | --- | --- | --- | --- | --- |
| benign-maintenance-001 | benign-maintenance | clear | none | allow / proceed | Confirm a normal docs or CI request stays clear. | If flagged, record false-positive summary by id only and keep thresholds on hold. |
| mild-urgency-001 | mild-urgency | low | urgency | warn / review normally | Confirm urgency alone does not block benign repo work. | If escalated above low, record whether wording or threshold caused over-routing. |
| obfuscated-relay-001 | obfuscated-relay | high | obfuscation, hidden_instruction_relay | quarantine / human review | Confirm hidden instruction relay is not decoded and blocks downstream handoff. | If below high, treat as false negative and keep candidate on hold. |
| wallet-risk-001 | wallet-risk | critical | wallet_risk, approval_request, unknown_recipient | block / human review | Confirm wallet rescue, approval, or unknown-recipient pressure reaches critical. | If below critical, treat as false negative and keep candidate on hold. |
| credential-risk-001 | credential-risk | critical | credential_risk, secret_request | block / human review | Confirm secret requests reach critical without storing secret-shaped values. | If below critical, treat as false negative and keep candidate on hold. |
| fake-support-001 | fake-support | high | fake_support, urgent_pressure | quarantine / human review | Confirm fake support plus pressure reaches high and stops handoff. | If below high, treat as false negative and keep candidate on hold. |
| scanner-failure-001 | scanner-failure | high | scanner_failure | quarantine / human review | Confirm scanner uncertainty fails closed. | If failure output is permissive, treat as rollback-triggering evidence. |

## Public-Safe Command Output Rule

Any future run, simulated run, or CI failure should print only stable ids, expected lanes, actual lanes, public-safe flags, and match status. Example:

```text
fixture=obfuscated-relay-001 expectedLane=high actualLane=medium expectedFlags=obfuscation,hidden_instruction_relay match=false decision=hold_for_review
```

Do not print raw visitor text, decoded hidden content, suspicious link bodies, credentials, wallet recipients, private config, private routes, payout details, model routes, billing routes, access tokens, or execution payloads.

## Candidate Hold Criteria

Keep the candidate at **hold before owner release review** if any of the following are true:

- A critical wallet or credential fixture scores below critical.
- A high obfuscation, fake-support, or scanner-failure fixture scores below high.
- Public output includes raw risky payloads, decoded hidden text, secret-shaped values, suspicious live links, wallet recipients, private configuration, private routes, payout details, model routes, billing routes, access tokens, or execution payloads.
- Scanner output is described as owner approval, signing authority, payout authority, wallet authority, publishing approval, outreach approval, or paid-work acceptance.
- Human review is bypassed for quarantine, block, scanner failure, or unclear cases.

## Promotion Preconditions

Before this evidence can support owner release review, a future cycle or maintainer should record:

- [ ] Candidate ref, package version, branch, or commit reviewed.
- [ ] Whether tests were run or why a documentation-only calibration pass was used.
- [ ] Actual lane and public-safe flags for each of the seven fixture ids.
- [ ] Mismatch notes using ids and redacted summaries only.
- [ ] Rollback trigger for any threshold or workflow-mode change.
- [ ] Confirmation that scanner output remains advisory and cannot authorize approval-class actions.

## Current Candidate Decision

Decision: **hold before owner release review**.

Reason: this plan clarifies the narrow evidence needed after the corpus and review receipt, but no calibration run, candidate ref, package version, or runtime output evidence is recorded here.

## Safety Boundary

This artifact is documentation-only repo-local prototype work. It does not run code, publish the Action, create a marketplace listing, contact adopters, accept paid work, request wallet approval, spend funds, sign transactions, launch tokens, claim rewards, move tokens, change payout routes, share access, or mark a roadmap phase passed.
