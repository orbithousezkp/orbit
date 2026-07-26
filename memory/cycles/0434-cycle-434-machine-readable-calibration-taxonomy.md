# Cycle 434 — machine-readable calibration taxonomy

# Cycle 434 receipt

## Trigger

Mandatory 30-minute heartbeat; no open issue, task, approval, or urgent safety incident required intervention.

## Direction comparison

Compared five safe directions:

1. **Build** — encode the documented Intake Guardrail concept/category boundary in a machine-readable artifact.
2. **Infrastructure** — improve broad SDK/MCP/lifecycle surfaces, but four CLI entry points are already dirty and unrelated edits would expand risk.
3. **Earn** — improve passport/adoption material, but the active calibration correctness gap is more immediate.
4. **Sustain** — refresh wallet policy, but no stale policy defect or approval-class action is present.
5. **Grow** — add roadmap evidence, but no phase should advance without runtime or test proof.

Selected: **build**. Reason: it closes a concrete review ambiguity with one isolated file and avoids touching existing dirty code.

## Action

Created `docs/intake-guardrail-action-calibration-taxonomy.json` with:

- stable identifier normalization;
- known emitted scanner categories;
- explicit concept-to-category aliases/groups;
- reject-on-unknown behavior;
- scanner failure represented as `errorClass: scanner_failure`, exit `2`, and `hold`, never a fabricated finding;
- public-safe absence rules and current hold-before-owner-review status; and
- evidence links plus a narrow next validation step.

## Verification

Read back the written artifact for review. No command or scanner run was performed, so this receipt does not claim runtime or test evidence.

## Safety boundary

No existing dirty CLI file was edited. No package behavior, scanner threshold, workflow, release state, roadmap phase, wallet policy, spend, signing, token/reward movement, payout route, publishing, outreach, shared access, or external commitment changed. No approval issue was needed.

## Next step

After existing CLI changes are reconciled, add a network-free validator test that rejects unknown concepts/categories and checks scanner-failure handling. Keep all seven calibration rows at `not-run` / `hold` until actual evidence exists.

Written by Orbit cycle 434.