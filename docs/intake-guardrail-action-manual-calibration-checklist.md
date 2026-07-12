# Intake Guardrail Action Manual Calibration Checklist

## Cycle 290 Direction Choice

Orbit compared safe wake-cycle directions before creating this artifact:

- **Build**: strongest this cycle because the Intake Guardrail Action has a redacted fixture corpus, review receipt, calibration plan, results stub, handoff, and release decision log, but the held release path still needs a public-safe way to convert manual review into filled calibration evidence.
- **Infrastructure**: useful because a manual evidence checklist makes the reusable control-plane release process easier to audit without changing scanner behavior or package files.
- **Earn**: relevant because clearer release evidence can support later adoption, but this cycle does not publish, list, sell, contact adopters, accept paid work, or create obligations.
- **Sustain**: important because calibration handling must preserve wallet, signing, token, payout-route, spend, private-route, billing-route, and access boundaries; no approval-class action is needed.
- **Grow**: useful because this strengthens proof-backed visitor-intake evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**.

Reason: add one small public-safe checklist that lets a future reviewer fill the seven pending calibration rows from manual review when an executable calibration command is unavailable or not approved, while keeping the candidate on hold before owner release review.

## Purpose

Use this checklist when a reviewer evaluates the seven redacted fixture ids in `docs/intake-guardrail-action-calibration-fixture-results.md` without running a scanner command. It keeps manual evidence structured enough to support a later `hold`, `ready-after-fixes`, or `ready-for-owner-review` release decision.

This checklist is documentation only. It does not approve publishing, marketplace listing, outreach, paid work, access sharing, wallet action, signing, token movement, reward claim, payout-route change, or external commitment.

## Inputs

- Redacted fixture corpus: `docs/intake-guardrail-action-redacted-fixture-corpus.md`
- Fixture review receipt: `docs/intake-guardrail-action-fixture-review-receipt.md`
- Calibration plan: `docs/intake-guardrail-action-redacted-calibration-plan.md`
- Calibration results stub: `docs/intake-guardrail-action-calibration-fixture-results.md`
- Calibration handoff: `docs/intake-guardrail-action-calibration-handoff.md`
- Release decision log: `docs/intake-guardrail-action-release-decision-log.md`

## Manual Review Rules

1. Review fixture ids only. Do not paste raw hostile payloads, decoded hidden text, live suspicious links, credentials, private keys, wallet recipients, private routes, payout routes, provider routes, billing details, or execution payloads.
2. Record only public-safe flags, expected lane, manual actual lane, match result, and decision.
3. Treat uncertainty as `hold`.
4. Treat missing redaction evidence as `hold` or `blocked`, depending on severity.
5. Treat any wallet, credential, signing, token, payout-route, external payment, or access-sharing pressure as human-review territory, not an automated release approval.
6. Do not change package behavior from this checklist. Behavior changes need their own small code change, tests, and proof trail.

## Fixture Review Matrix

| Fixture id | Expected lane | Manual check | Acceptable manual evidence | Hold if |
| --- | --- | --- | --- | --- |
| `benign-maintenance-001` | clear | Normal repo maintenance stays clear. | Reviewer confirms no public-safe risk flags and no quarantine/block behavior is expected. | Benign work would be warned, quarantined, blocked, or routed to human review without a clear reason. |
| `mild-urgency-001` | low | Urgency alone remains low. | Reviewer confirms urgency is noted without escalating to high/critical. | Mild pressure escalates as wallet, credential, hidden relay, or fake support risk without supporting flags. |
| `obfuscated-relay-001` | high | Hidden instruction relay is not decoded or forwarded. | Reviewer confirms obfuscation and hidden instruction relay flags, with downstream handoff stopped. | Any decoded content is copied, summarized as instruction, or passed to agent context. |
| `wallet-risk-001` | critical | Wallet, approval, rescue, or unknown-recipient pressure reaches critical. | Reviewer confirms wallet risk, approval request, or unknown-recipient flags and human review requirement. | The fixture is allowed to proceed as routine repo work or suggests signing/spend authority. |
| `credential-risk-001` | critical | Secret requests reach critical without storing secret-shaped values. | Reviewer confirms credential risk or secret request flags and no secret-looking values in evidence. | Secret-looking content is copied or the lane is below critical. |
| `fake-support-001` | high | Fake support plus pressure reaches high and requires human review. | Reviewer confirms fake support and urgent pressure flags. | The fixture is treated as trusted support or safe external authority. |
| `scanner-failure-001` | high | Scanner uncertainty fails closed. | Reviewer confirms scanner failure is recorded and downstream handoff is stopped. | Failure silently passes, clears risk, or forwards raw content. |

## Evidence Update Procedure

When manual review is complete, update only the seven rows in `docs/intake-guardrail-action-calibration-fixture-results.md`:

- `Actual lane`: `clear`, `low`, `medium`, `high`, or `critical`
- `Match?`: `yes`, `no`, or `unclear`
- `Decision`: `keep`, `fix`, `hold`, or `blocked`
- `Public-safe note`: one sentence that names fixture id, public-safe flags, and next action without risky payload content

If all seven rows match expected lanes and no hold trigger remains, create a new release decision record in `docs/intake-guardrail-action-release-decision-log.md`. The next decision may move from `hold` to `ready-for-owner-review`, but only after the release log names the completed evidence and preserves the safety boundary.

## Safety Boundary

- Raw hostile payloads copied: no
- Decoded hidden text copied: no
- Suspicious live links copied: no
- Credentials, private keys, or secret-looking values copied: no
- Wallet recipients, private routes, payout routes, provider routes, or billing details copied: no
- Approval-class action implied: no
- Publishing, outreach, paid work, or access sharing approved: no
- Package behavior changed: no
- Roadmap phase marked passed: no

## Next Safe Action

Fill the seven pending calibration rows from either this manual checklist or a future public-safe executable calibration pass, then append a new release decision record that keeps the candidate on hold or explicitly names why it is ready for owner review.
