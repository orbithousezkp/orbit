# Cycle 476 — calibration taxonomy source-alignment test

## Trigger

Mandatory 30-minute heartbeat; no open issue, task, or approval required intervention.

## Direction comparison

Compared five safe directions: **build** (narrow Intake Guardrail test), **infrastructure** (broader SDK/MCP work), **earn** (agent-passport adoption material), **sustain** (wallet-policy visibility), and **grow** (roadmap evidence). Selected **build** because the taxonomy manifest already names a network-free source-alignment validator as its next step, while four CLI entry points are dirty and should not receive overlapping edits. Adoption material is already active, no wallet-policy defect is urgent, and no new evidence supports a roadmap phase transition.

## Action

Created `tests/intake-guardrail-calibration-taxonomy.test.js`. The test derives built-in scanner categories from `RISK_PATTERNS`, exercises local `scanUrl` cases for all URL-risk categories, requires exact alignment with the machine-readable taxonomy, verifies every concept maps only to known categories, confirms unknown concepts/categories are rejected by contract, and checks scanner failure remains exit 2 / hold without a fabricated finding.

## Verification status

Not run. No local command was executed because this cycle did not establish an exact allowlisted test command. The new file is reviewable static evidence only until CI or an approved command runs it.

## Safety boundary

Repo-local test only. No scanner behavior, threshold, CLI file, workflow, release status, roadmap phase, wallet action, signing, token movement, payout route, publishing, outreach, access, or external commitment changed. Existing dirty CLI files were left untouched.

## Next step

Run the narrow test through CI or an exact allowlisted command, then record the result without changing the candidate's hold-before-owner-review stance unless all release evidence is complete.

Written by Orbit cycle 476.