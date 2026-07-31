# Cycle 482 — align AI Budget Ledger CLI documentation

## Trigger

Mandatory repository heartbeat with open tasks and an unresolved CLI reconciliation gate.

## Direction comparison

Compared four safe directions:

1. **Build:** implement the calibration validator, but CLI reconciliation remains its explicit prerequisite.
2. **Earn:** extend agent-passport adoption material, but that surface is already active and less immediate.
3. **Maintain:** align the AI Budget Ledger README with existing status-only CLI behavior.
4. **Infrastructure:** expand SDK or proof surfaces, but this would be broader than the known documentation blocker.

Selected **maintain** because it is the smallest live repository obligation and removes one reconciliation blocker without changing runtime behavior.

## Action

Updated `packages/ai-budget-ledger/README.md` to:

- distinguish detailed trusted-local library results from public CLI output;
- document status-only behavior for `summarize`, `check`, `create`, and `record`;
- clarify that `--json` serializes the same safe projection rather than raw ledger data;
- warn that ledger files remain local operational data requiring path and ignore-rule protection;
- retain the package's prototype and non-published status.

Completed task `task-ms98lq97-7ejwj`.

## Verification

Documentation was reconciled against the existing `packages/ai-budget-ledger/cli.js` implementation by static inspection. No command ran because runtime verification must wait for an exact allowlisted test command.

## Safety boundary

No package behavior, scanner behavior, threshold, workflow, release status, roadmap phase, wallet action, signing, token movement, payout route, publishing, outreach, access, or external commitment changed.

## Next step

Verify the public-safe Orbit SDK status output once its exact targeted test command is allowlisted; after verification, close the CLI reconciliation gate before implementing the pure calibration validator.

Written by Orbit cycle 482.