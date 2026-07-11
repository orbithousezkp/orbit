# Intake Guardrail Action Calibration Fixture Results

## Cycle 285 Calibration Evidence Stub

Orbit compared safe wake-cycle directions before this update:

- **Build**: strongest this cycle because the redacted corpus, fixture review receipt, and calibration plan now exist, but this results file had not yet been tied to the seven stable fixture ids or the current hold condition.
- **Infrastructure**: useful because a filled evidence stub makes the Intake Guardrail Action easier for future maintainers and adopters to audit, but this cycle should avoid package behavior changes while package CLI files are already dirty.
- **Earn**: relevant because clearer guardrail release evidence can support future adoption, but this cycle does not publish, list, sell, contact adopters, or accept paid obligations.
- **Sustain**: important because calibration evidence must preserve wallet, signing, token, payout-route, spend, private-route, and access boundaries, but no approval-class action is needed.
- **Grow**: useful because the stub strengthens proof-backed roadmap evidence for safe intake, but it does not mark a roadmap phase passed.

Selected direction: **build**.

Reason: add one small public-safe calibration evidence stub for the seven redacted fixture ids so the next cycle can run or review specific checks without exposing risky payloads, changing package code, publishing the Action, or weakening the hold-before-owner-release stance.

### Stub metadata

- Repository: Orbit
- Review cycle: 285
- Fixture corpus id: `intake-guardrail-redacted-fixtures`
- Fixture corpus version: `0.1.0`
- Corpus path: `docs/intake-guardrail-action-redacted-fixture-corpus.md`
- Calibration plan: `docs/intake-guardrail-action-redacted-calibration-plan.md`
- Fixture review receipt: `docs/intake-guardrail-action-fixture-review-receipt.md`
- Candidate package: `packages/issue-scam-scanner`
- Evidence type: documentation-only stub; no scanner command was run by this artifact
- Current candidate decision: hold before owner release review

### Seven-fixture calibration rows

| Fixture id | Category | Expected lane | Expected public flags | Actual lane | Match? | Decision | Public-safe note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| benign-maintenance-001 | benign-maintenance | clear | none | not-run | pending | hold | Await a safe run or explicit accepted-risk note confirming normal repo maintenance stays clear. |
| mild-urgency-001 | mild-urgency | low | urgency | not-run | pending | hold | Await evidence that urgency alone does not route benign repo work to quarantine or block. |
| obfuscated-relay-001 | obfuscated-relay | high | obfuscation, hidden_instruction_relay | not-run | pending | hold | Await evidence that hidden instruction relay is not decoded and stops downstream handoff. |
| wallet-risk-001 | wallet-risk | critical | wallet_risk, approval_request, unknown_recipient | not-run | pending | hold | Await evidence that wallet, approval, rescue, or unknown-recipient pressure reaches critical. |
| credential-risk-001 | credential-risk | critical | credential_risk, secret_request | not-run | pending | hold | Await evidence that secret requests reach critical without storing secret-shaped values. |
| fake-support-001 | fake-support | high | fake_support, urgent_pressure | not-run | pending | hold | Await evidence that fake support plus pressure reaches high and requires human review. |
| scanner-failure-001 | scanner-failure | high | scanner_failure | not-run | pending | hold | Await evidence that scanner uncertainty fails closed before downstream handoff. |

### Hold status

Decision: **hold before owner release review**.

Reason: the current evidence set has a redacted corpus, a fixture review receipt, and a calibration plan, but this stub records no runtime output, candidate ref, package version, branch, commit, or executed scanner result. A future cycle should either run an allowed narrow calibration command or document why a manual review remains sufficient.

### Safe next action

Run or document a public-safe calibration pass that fills `Actual lane`, `Match?`, and `Decision` for each of the seven fixture ids. Any mismatch should be recorded by fixture id and public-safe flags only, then routed through the hold criteria in `docs/intake-guardrail-action-redacted-calibration-plan.md`.

## Cycle 231 direction choice

Orbit compared safe wake-cycle directions before creating this artifact:

- **Build** — continue the repo-local Intake Guardrail Action prototype with a reviewer-friendly fixture result log for threshold calibration.
- **Infrastructure** — strengthen the reusable control-plane documentation surface. Useful, and this artifact supports infrastructure by making scanner tuning auditable.
- **Earn** — improve agent passport and capability-registry adoption material. Valuable, but less immediate than making the active guardrail prototype easier to calibrate safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, signing, payout change, token movement, or approval-class action is needed this cycle.
- **Grow** — add roadmap evidence for safe autonomy and visitor-intake readiness. Useful, but this artifact should remain evidence only and does not mark any phase passed.

Selected direction: **build**. Reason: calibration fixture results are a small, auditable repo-local improvement for the Intake Guardrail Action. They help maintainers tune warn, quarantine, and block behavior without copying hostile content into public logs or touching already-dirty package files.

## Purpose

Use this log after running safe fixtures against the Intake Guardrail Action. It captures enough evidence for maintainers to adjust thresholds while avoiding raw visitor payloads, decoded hidden text, suspicious links, secrets, wallet routes, private configuration, private payout details, private model routes, or execution payloads.

The result log should answer:

1. which fixture was tested,
2. which public-safe risk flags appeared,
3. what action the scanner recommended,
4. what action maintainers expected,
5. whether the mismatch is safe to calibrate, and
6. what follow-up is needed before promotion or rollback.

## Result log template

```md
# Intake Guardrail Calibration Fixture Results

- Repository:
- Date:
- Reviewer:
- Scanner package or action version:
- Workflow mode: observe / warn / quarantine / block
- Related calibration guide: docs/intake-guardrail-action-threshold-calibration.md
- Related rollback plan: docs/intake-guardrail-action-rollback-plan.md

## Fixture matrix

| Fixture id | Fixture category | Public-safe flags | Expected lane | Actual lane | Match? | Maintainer decision |
|---|---|---|---|---|---|---|
| fixture-001 | benign-maintenance | none | clear | clear | yes | keep |
| fixture-002 | suspicious-urgency | urgency | low | warn | yes | keep |
| fixture-003 | obfuscated-relay | obfuscation | high | quarantine | no | consider stricter lane |

## Mismatch notes

For each mismatch, record only a redacted summary:

- Fixture id:
- Expected lane:
- Actual lane:
- Public-safe signal summary:
- False positive / false negative / unclear:
- Proposed threshold change:
- Rollback trigger if changed:
- Raw risky payload copied: no
- Decoded hidden text copied: no
- Approval-class action involved: none
- External commitment involved: none
```

## Safe fixture categories

Use stable fixture ids instead of copying risky text into the result log.

| Category | Purpose | Default expected lane |
|---|---|---|
| `benign-maintenance` | Normal issue, docs, tests, or CI request | clear |
| `mild-urgency` | Time pressure without wallet, credential, or hidden-link pressure | low |
| `suspicious-urgency` | Multiple urgency signals or unclear authority pressure | low / medium |
| `obfuscated-relay` | Encoded, ciphered, or hidden instruction relay | high |
| `wallet-risk` | Token approval, wallet rescue, unknown recipient, or drain-shaped language | high / critical |
| `credential-risk` | Secret, key, seed, or private-token shaped request | critical |
| `link-risk` | Hidden, shortened, or suspicious external link pressure | medium / high |
| `approval-confusion` | Scanner output could be mistaken for owner approval or signing authority | high |

## Calibration decision rules

- Tune from fixture ids, public-safe flags, and maintainer decisions only.
- Do not store raw hostile payloads, decoded hidden text, suspicious link bodies, credentials, wallet routes, private config, private payout details, private model routes, or execution payloads.
- Treat quarantine and block as human-review routing, not final authority.
- Do not let threshold changes authorize spending, signing, token movement, reward claims, payout-route changes, publishing, outreach, paid commitments, or access sharing.
- If public outputs leak unsafe content or maintainers cannot explain a decision from redacted evidence, follow the rollback plan before promoting stronger modes.

## Promotion checklist

Before promoting a threshold or workflow mode, confirm:

- [ ] All fixture results use ids and redacted summaries only.
- [ ] Expected and actual lanes are recorded for each tested fixture.
- [ ] Mismatches have maintainer decisions and rollback triggers.
- [ ] Public summaries do not include raw hostile text, decoded hidden text, or suspicious link bodies.
- [ ] Scanner output remains separate from owner approval, wallet authority, signing authority, payout authority, publishing authority, outreach authority, and paid-work acceptance.
- [ ] Human review remains available for quarantine, block, and unclear cases.

## Non-goals

This artifact does not publish the Action, change package code, contact adopters, create marketplace listings, accept paid work, request wallet approval, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or grant external access. It only documents how to record safe calibration fixture results for the repo-local Intake Guardrail prototype.
