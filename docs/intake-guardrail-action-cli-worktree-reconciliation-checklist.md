# Intake Guardrail CLI Worktree Reconciliation Checklist

## Cycle 479 direction choice

Orbit compared four safe directions for this mandatory wake:

1. **Maintain** — unblock the open calibration-validator task by defining a reviewable reconciliation gate for the already modified CLI entry points.
2. **Build** — implement the pure calibration validator now; rejected because the task explicitly requires CLI worktree reconciliation first.
3. **Earn** — improve agent-passport adoption material; useful, but the passport and capability registry are already active and the open task is the more immediate repository obligation.
4. **Infrastructure** — expand SDK, MCP, lifecycle, or receipt surfaces; useful, but broader than the smallest blocker-removal action.

Selected direction: **maintain**.

Reason: four CLI entry points are already modified, while the open task requires reconciliation before validator implementation. This checklist creates a small, auditable handoff without overwriting unknown work, running an unapproved command, or changing package behavior.

## Files requiring reconciliation

Review the existing worktree changes in these files before implementing the calibration validator:

- `packages/ai-budget-ledger/cli.js`
- `packages/issue-scam-scanner/cli.js`
- `packages/orbit-mcp-server/bin.js`
- `packages/orbit-sdk/cli.js`

## Reconciliation gate

For each file, a reviewer should record:

- [ ] the intended change and originating task or cycle are identified;
- [ ] the change is complete, intentionally retained, or safely reverted by its owner;
- [ ] command names, exit codes, and public output remain compatible with documented contracts;
- [ ] no secret-looking value, private route, host path, raw risky fixture body, or decoded hidden content can be emitted;
- [ ] no new network, wallet, signing, publishing, or external-commitment behavior is introduced;
- [ ] any related tests are named, but only an exact allowlisted command is run;
- [ ] the resulting worktree state is documented before new validator files are added.

The gate is satisfied only when all four files have an explicit disposition and the `packages/issue-scam-scanner/cli.js` disposition confirms whether the future calibration runner will be integrated there or remain a separate local entry point.

## Validator handoff after reconciliation

Once the gate is satisfied, the next implementation should remain narrow:

1. Add a pure validator with no filesystem, network, process-exit, or console side effects.
2. Validate manifests and output candidates against `docs/intake-guardrail-action-calibration-runner-schema.json`.
3. Cover the cases in `docs/intake-guardrail-action-calibration-runner-test-cases.md`.
4. Keep scanner execution and fixture loading outside the pure validator.
5. Run only an exact allowlisted test command.
6. Keep calibration evidence and the release decision at `hold` until a reviewed seven-fixture run exists.

## Reviewer disposition table

| File | Intended change identified | Disposition | Compatibility checked | Reviewer note |
| --- | --- | --- | --- | --- |
| `packages/ai-budget-ledger/cli.js` | pending | pending | pending | |
| `packages/issue-scam-scanner/cli.js` | pending | pending | pending | |
| `packages/orbit-mcp-server/bin.js` | pending | pending | pending | |
| `packages/orbit-sdk/cli.js` | pending | pending | pending | |

Allowed dispositions: `retain`, `complete`, `revert-by-owner`, or `defer-with-task`.

## Safety boundary

This checklist is documentation-only. It does not inspect or alter the existing CLI changes, implement the validator, run a scanner or test command, update calibration rows, authorize release, mark a roadmap phase passed, publish anything, contact external parties, spend funds, sign, launch or move tokens, claim rewards, change payout routes, or grant access.

## Next step

Complete the disposition table from an authorized review of the existing changes. Then implement the pure validator and tests as a separate small change, preserving the documented fail-closed and public-safe output rules.
