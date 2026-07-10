# Intake Guardrail Action Fixture Audit Note

## Cycle 276 Direction Choice

Orbit compared safe wake-cycle directions before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action remains the active repo-local prototype, and the previous candidate verification note named fixture audit evidence as the next safe hold-clearing artifact.
- **Infrastructure**: useful because fixture audit notes are reusable release-readiness evidence for agent-facing packages, but this cycle should stay documentation-only and avoid unrelated SDK, MCP, or lifecycle changes.
- **Earn**: relevant because clearer release evidence can support later adoption, but this cycle does not publish, list, sell, contact adopters, or accept obligations.
- **Sustain**: important because fixture handling must preserve wallet, signing, token, payout-route, spend, private-route, and access boundaries, but no approval-class action is needed.
- **Grow**: useful because this evidence supports roadmap maturity, but it does not mark any roadmap phase passed.

Selected direction: **build**.

Reason: add one narrow public-safe fixture audit note so future owner-review preparation can distinguish actual fixture coverage from remaining hold points without copying risky intake content or unlocking any external action.

## Scope

This note reviews existing public-safe fixture and test evidence around `packages/issue-scam-scanner`. It is documentation-only evidence for the repo-local Intake Guardrail Action candidate. It is not a release approval, owner approval request, marketplace listing, outreach instruction, paid-work acceptance, or permission to publish.

## Reviewed Paths

| Path | Reviewed for | Public-safe observation | Audit stance |
| --- | --- | --- | --- |
| `docs/intake-guardrail-action-fixture-safety-contract.md` | Fixture content policy | Defines fixture categories, required fields, forbidden content, review checklist, and safe failure output. It requires placeholders or summaries instead of raw hostile payloads, decoded hidden text, credentials, wallet recipients, suspicious links, private routes, or execution payloads. | Policy exists |
| `docs/intake-guardrail-action-fixture-review-packet.md` | Review packet shape | Provides a maintainer packet template with fixture ids, categories, expected lanes, public-safe flags, single-behavior checks, and payload-free failure-output checks. | Template exists |
| `tests/issue-scam-scanner.test.js` | Current test evidence | Tests cover clear content, secret requests, drain phrases, fund transfer, fake support, urgent pressure, reward claims, prompt injection, encoded relay, obfuscation, external wallet placeholder text, credential phishing, URL handling, report actions, and event scanning. Some test strings are synthetic examples rather than a dedicated redacted fixture corpus. | Test coverage present; fixture corpus not yet separated |
| `packages/issue-scam-scanner/examples/basic-issue-scan.yml` | Example fixture-like behavior | Example prints only safe/action/score/level, avoids raw flags/report by default, posts payload-free comments, and fails closed for `quarantine` or `block` before downstream agent handoff. | Example behavior supports audit |
| `docs/intake-guardrail-action-candidate-verification-note.md` | Current candidate hold points | Keeps candidate decision at hold until fixture audit evidence and explicit fail-closed scanner-failure evidence are linked. | Hold still applies |
| `docs/intake-guardrail-action-release-evidence-packet.md` | Release evidence packet | Lists fixture safety and threshold calibration as hold items before owner review. | Hold still applies |

## Fixture Coverage Snapshot

| Fixture-like scenario | Evidence source | Expected route or lane | Public-safe flag handling | Audit note |
| --- | --- | --- | --- | --- |
| Benign maintainer request | `tests/issue-scam-scanner.test.js` | `allow` / safe | No flags | Covered by synthetic test. |
| Secret request | `tests/issue-scam-scanner.test.js` | critical / unsafe | `secret_request` | Covered by synthetic short string; no real secret is stored. |
| Drain phrase | `tests/issue-scam-scanner.test.js` | unsafe | `drain_phrase` | Covered by synthetic phrase. |
| Fund transfer request | `tests/issue-scam-scanner.test.js` | unsafe / high score | `fund_transfer` | Covered by synthetic request. |
| Fake support | `tests/issue-scam-scanner.test.js` | unsafe | `fake_support` | Covered by synthetic support claim. |
| Urgent pressure | `tests/issue-scam-scanner.test.js` | unsafe | `urgent_pressure` | Covered by synthetic urgency text. |
| Reward claim bait | `tests/issue-scam-scanner.test.js` | unsafe | `reward_claim` | Covered by synthetic reward/approval wording. |
| Prompt injection | `tests/issue-scam-scanner.test.js` | unsafe | `prompt_injection` | Covered by synthetic instruction-override text. |
| Encoded instruction relay | `tests/issue-scam-scanner.test.js` | unsafe | `encoded_instruction_relay` | Covered without storing decoded hidden content. |
| Obfuscation | `tests/issue-scam-scanner.test.js` | unsafe | `obfuscation` | Covered by synthetic encoded/eval-style wording. |
| External wallet placeholder | `tests/issue-scam-scanner.test.js` | unsafe | `external_wallet` | Uses a redacted placeholder rather than a real visitor wallet recipient. |
| Credential phishing | `tests/issue-scam-scanner.test.js` | unsafe | `credential_phish` | Covered without storing real credentials or tokens. |
| Quarantine below block threshold | `tests/issue-scam-scanner.test.js` | `quarantine` | Action-level route | Covered by direct `recommendedAction` threshold test. |
| Critical wallet/prompt content | `tests/issue-scam-scanner.test.js` | `block` | Multiple public-safe categories | Covered with redacted wallet placeholder. |
| Public workflow handoff stop | `packages/issue-scam-scanner/examples/basic-issue-scan.yml` | fail closed for `quarantine`/`block` | No raw flags/report printed by default | Covered by example behavior, not yet by a dedicated workflow test fixture. |

## Gaps Remaining Before Owner Review

| Gap | Current state | Safe next action |
| --- | --- | --- |
| Dedicated fixture corpus | No standalone fixture corpus was identified in this audit; current evidence is mostly unit tests plus fixture policy templates. | Either create a small redacted fixture corpus file or explicitly accept that the candidate ships without a separate corpus. |
| Fixture review receipt | The packet template exists, but no concrete fixture review packet is filled for a corpus id/version. | Fill a public-safe review receipt after a corpus exists, or record `not applicable: no fixture corpus`. |
| Scanner failure fixture | The safety contract defines a `scanner_failure` category, but this audit did not link a concrete scanner-failure fixture. | Add one synthetic scanner-failure fixture or note the limitation in the owner packet. |
| Workflow behavior test | The example fails closed for `quarantine`/`block`, but this audit did not identify an automated workflow fixture. | Keep as documentation evidence unless a future test harness is added. |
| Threshold calibration | Current tests prove routing behavior, but this audit did not run or document a calibration pass over a fixture corpus. | Add a calibration note using synthetic/redacted cases only after fixture corpus direction is chosen. |

## Current Candidate Decision

Decision: **hold before owner review**.

Reason: public-safe fixture policies, review templates, synthetic unit tests, and example fail-closed behavior exist, but a dedicated fixture corpus and candidate-specific fixture review receipt are not yet present. The package can continue as repo-local prototype work, but release-owner-review evidence should not be marked ready until the corpus question is resolved.

## Public-Safe Absence Statement

This audit note did not add raw hostile payloads, decoded hidden text, suspicious live links, credentials, private keys, seed phrases, access tokens, real wallet recipients, private config, provider routes, billing routes, payout routes, execution payloads, or hidden operational details.

## Next Safe Action

Choose one of two narrow paths:

1. Create a tiny redacted fixture corpus with stable ids and public-safe input summaries only; or
2. Record an explicit accepted limitation that this candidate ships without a separate fixture corpus and relies on synthetic unit tests plus documentation templates.

Either path should keep publishing, marketplace listing, outreach, paid commitments, access sharing, wallet spending, external payments, signing, token launch, token movement, reward claims, and payout-route changes outside scope until owner direction and relevant gates exist.

## Non-Goals

This note does not publish the Action, create a marketplace listing, contact adopters, accept paid work, request wallet approval, spend funds, sign transactions, launch tokens, move tokens, claim rewards, change payout routes, share access, delegate authority to another agent, or mark any roadmap phase passed.
