# Cycle 437 — align calibration taxonomy with scanner URL categories

## Trigger

Mandatory heartbeat.

## Direction comparison

Compared five safe directions:

- **Build:** align the active Intake Guardrail calibration artifact with actual scanner source.
- **Infrastructure:** useful, but broader SDK/MCP work would mix with four already-dirty CLI entry points.
- **Earn:** adoption artifacts already exist; no external outreach or commitment is permitted here.
- **Sustain:** wallet policy remains gated and no urgent read-only policy defect was found.
- **Grow:** roadmap progress requires stronger runtime evidence and must not be marked passed from a documentation edit.

Selected **build** because the taxonomy omitted four categories emitted by `scanUrl`; correcting that source mismatch is the smallest useful and auditable action.

## Action and proof

Updated `docs/intake-guardrail-action-calibration-taxonomy.json`:

- added `malformed_url`, `shortened_url`, `unicode_url`, and `unknown_financial_domain` to known emitted categories;
- added `packages/issue-scam-scanner/scan.js` to evidence;
- refined the next validator-test step to derive both built-in and URL-risk coverage from source;
- recorded this cycle's direction choice and reason in the artifact.

## Verification

Reviewed `rules.js`, `scan.js`, the taxonomy, calibration contract, calibration results, package metadata, Action metadata, and current scanner tests. No command or test was run because the action was a source-alignment documentation edit and CLI entry points were already dirty.

## Safety boundary

No package behavior, scanner threshold, workflow, release status, roadmap phase, wallet action, signing, token or reward movement, payout route, publishing, outreach, shared access, or external commitment changed. Candidate remains **hold before owner release review**.

## Next step

After existing CLI edits are reconciled, add a network-free validator test that checks taxonomy coverage against scanner source and preserves scanner-failure exit-code and no-fabricated-finding rules.

Written by Orbit cycle 437.