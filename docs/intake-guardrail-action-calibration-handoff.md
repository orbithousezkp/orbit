# Intake Guardrail Action Calibration Handoff

## Cycle 287 direction comparison

Orbit compared safe wake-cycle directions before creating this artifact:

- **Build**: strongest because the Intake Guardrail Action already has a redacted fixture corpus, fixture review receipt, calibration plan, and results stub, but the next reviewer still needs a compact handoff that says exactly how to fill the pending result rows without exposing risky payloads.
- **Infrastructure**: useful because a handoff note makes the reusable repository control-plane evidence easier to audit, but this cycle should not change package behavior while package CLI files are already dirty.
- **Earn**: relevant because a clearer guardrail release path supports future adoption, but this cycle does not publish, list, sell, contact adopters, or accept paid obligations.
- **Sustain**: important because the guardrail must preserve wallet, signing, token, payout-route, spend, private-route, and access boundaries, but no approval-class action is needed.
- **Grow**: useful because calibration handoff evidence supports proof-backed roadmap growth, but this artifact does not mark a roadmap phase passed.

Selected direction: **build**.

Reason: create one small public-safe handoff artifact that turns the existing calibration stub into an auditable next action while preserving the current hold-before-owner-release-review stance.

## Scope

This handoff is for `packages/issue-scam-scanner` and the Intake Guardrail Action evidence set:

- Fixture corpus: `docs/intake-guardrail-action-redacted-fixture-corpus.md`
- Fixture review receipt: `docs/intake-guardrail-action-fixture-review-receipt.md`
- Calibration plan: `docs/intake-guardrail-action-redacted-calibration-plan.md`
- Calibration results stub: `docs/intake-guardrail-action-calibration-fixture-results.md`

It is documentation-only. It does not run the scanner, alter thresholds, publish an Action, create marketplace copy, contact adopters, accept paid work, spend funds, sign, launch tokens, move tokens, claim rewards, change payout routes, or grant access.

## Reviewer handoff checklist

Before changing the candidate decision from `hold`, a reviewer should fill the pending `Actual lane`, `Match?`, and `Decision` cells in the calibration results stub for each redacted fixture id.

For every fixture row, record only:

1. fixture id,
2. public-safe expected lane,
3. public-safe actual lane,
4. whether the lane matched,
5. public-safe flags emitted,
6. maintainer decision: `keep`, `adjust`, `rerun`, or `hold`, and
7. a short note that does not copy raw risky payloads.

Do **not** record raw hostile text, decoded hidden content, suspicious live links, credentials, wallet recipients, private config, private route details, billing details, private payout details, signer material, or execution payloads.

## Fixture-specific acceptance criteria

| Fixture id | Acceptance criterion | If criterion fails |
| --- | --- | --- |
| `benign-maintenance-001` | Stays `clear` with no public flags. | Keep candidate on hold and inspect false-positive source. |
| `mild-urgency-001` | Routes to `low`/warn-equivalent and does not block ordinary maintenance by urgency alone. | Keep candidate on hold and document threshold mismatch. |
| `obfuscated-relay-001` | Routes to `high` or stricter without decoding or repeating hidden content. | Keep candidate on hold and require human review before promotion. |
| `wallet-risk-001` | Routes to `critical` with wallet/approval/unknown-recipient style public flags only. | Keep candidate on hold and do not enable downstream handoff. |
| `credential-risk-001` | Routes to `critical` with credential/secret-request style public flags only. | Keep candidate on hold and verify no secret-shaped values were stored. |
| `fake-support-001` | Routes to `high` or stricter with fake-support/pressure style public flags only. | Keep candidate on hold and require maintainer review. |
| `scanner-failure-001` | Fails closed to `high` or stricter before downstream agent handoff. | Keep candidate on hold and document fail-open risk. |

## Promotion boundary

The candidate remains **hold before owner release review** until calibration evidence shows the seven redacted fixture ids have public-safe actual lanes and decisions. Even after the rows are filled, publishing, outreach, paid commitments, marketplace listing, external access sharing, wallet actions, signing, token movement, reward claims, and payout-route changes remain gated by owner direction and the relevant approval/live-operation gates.

## Next safe action

Fill the seven pending rows in `docs/intake-guardrail-action-calibration-fixture-results.md` from a public-safe calibration run or a documented manual review. If command execution is not explicitly available, record that the pass remains manual and keep the candidate on hold.