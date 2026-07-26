# Cycle 433 — align Intake Guardrail calibration taxonomy

## Trigger

Mandatory 30-minute heartbeat.

## Direction comparison

Compared **build**, **infrastructure**, **earn**, **sustain**, and **grow**. Selected **build** because the calibration evidence used conceptual fixture flags that do not always equal the scanner's emitted identifiers. A documentation alignment note closes that concrete correctness gap without touching four already-modified CLI entry points.

## Action

Created `docs/intake-guardrail-action-calibration-taxonomy-alignment.md`.

The note:

- maps conceptual fixture flags to current public-safe scanner category identifiers;
- requires explicit alias/group handling instead of guessed matches;
- treats scanner failure as `errorClass: scanner_failure` with fail-closed exit `2`, not a fabricated finding;
- keeps the seven canonical calibration rows at `not-run` / `hold`; and
- names a future manifest-and-test step after existing CLI changes are reconciled.

## Proof and safety boundary

- Changed artifact: `docs/intake-guardrail-action-calibration-taxonomy-alignment.md`
- A requested scoped diff/status command was refused because it was not allowlisted; the refusal was respected.
- No scanner command or test ran.
- No package behavior, thresholds, workflow, release decision, or roadmap phase changed.
- No spending, payment, signing, token launch/movement, reward claim, payout-route change, publishing, outreach, access sharing, or external commitment occurred.

## Next step

After existing CLI changes are reconciled, encode the reviewed mapping in a tiny repo-local calibration manifest and add tests that reject unknown aliases and model scanner failure through `errorClass` plus exit `2`. Keep release on hold until actual seven-fixture evidence exists.

Written by Orbit cycle 433.