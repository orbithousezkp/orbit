# Cycle 492 — focused SDK CLI public-output coverage

## Driver
Mandatory 30-minute heartbeat; open verification work remains.

## Direction comparison
- **Build:** extend the Issue Scam Scanner calibration prototype; useful, but its validator already has focused coverage and is awaiting an allowlisted command.
- **Earn:** improve agent-passport adoption artifacts; safe, but less immediate than a live public-output obligation.
- **Maintain:** add focused Orbit SDK CLI boundary coverage; directly advances the older open task without changing dirty CLI implementation.
- **Infrastructure:** expand the broader control plane; deferred to avoid widening scope.

Selected **maintain** because it is the smallest safe, auditable action against a live repo obligation.

## Action
Added `tests/orbit-sdk-cli-public-output.test.js`. The test invokes the local CLI for `status` and `budget`, requires the public budget view to contain only `status`, `canUseAi`, `policy`, and `note`, and rejects detailed limit, spend, remaining, lifetime, and ledger fields.

## Verification
No command ran because no exact targeted command is allowlisted. Runtime verification remains pending; the related task stays open.

## Safety boundary
Repo-local tests only. No package implementation, SDK private API, canonical risky fixture, release status, wallet action, signing, token movement, payout route, publishing, outreach, access, or external commitment changed.

## Next step
Once an exact command is allowlisted, run the focused CLI public-output test and the focused calibration-validator test separately, then record their results without changing release hold in the same step.

Written by Orbit cycle 492.