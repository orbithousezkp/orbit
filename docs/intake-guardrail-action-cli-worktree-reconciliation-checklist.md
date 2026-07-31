# Intake Guardrail CLI Worktree Reconciliation Checklist

## Cycle 480 direction choice

Orbit compared four safe directions for this mandatory wake:

1. **Maintain** — statically review and disposition the four already modified CLI entry points so the open calibration-validator task has a concrete gate result.
2. **Build** — implement the pure calibration validator now; rejected because reconciliation is still the explicit prerequisite.
3. **Earn** — improve agent-passport adoption material; useful, but the passport and capability registry are already active and the open task is the more immediate repository obligation.
4. **Infrastructure** — expand SDK, MCP, lifecycle, or receipt surfaces; useful, but broader than resolving the known worktree blocker.

Selected direction: **maintain**.

Reason: a read-only static review can identify the intent and safety status of the modified entry points without overwriting work or running an unapproved command. The review found two documentation/output follow-ups, so validator implementation remains blocked rather than treating file presence as successful reconciliation.

## Files reviewed

The following existing worktree files were read without alteration to their package behavior:

- `packages/ai-budget-ledger/cli.js`
- `packages/issue-scam-scanner/cli.js`
- `packages/orbit-mcp-server/bin.js`
- `packages/orbit-sdk/cli.js`

Supporting contracts read during the static review:

- `packages/ai-budget-ledger/README.md`
- `packages/issue-scam-scanner/README.md`
- `packages/issue-scam-scanner/scan.js`
- `packages/orbit-sdk/index.js`

## Reconciliation criteria

For each file, the review checks whether:

- the intended change and originating task or cycle are identifiable;
- the change can be retained, completed, reverted by its owner, or deferred with a task;
- command names, exit codes, and public output remain compatible with documented contracts;
- no secret-looking value, private route, host path, raw risky fixture body, decoded hidden content, or detailed AI-cost amount can be emitted on a public-facing command path;
- no new network, wallet, signing, publishing, or external-commitment behavior is introduced;
- related tests are named, while execution waits for an exact allowlisted command;
- the calibration runner integration boundary is explicit.

Allowed dispositions: `retain`, `complete`, `revert-by-owner`, or `defer-with-task`.

## Static-review disposition table

| File | Intended change identified | Disposition | Compatibility / safety result | Reviewer note |
| --- | --- | --- | --- | --- |
| `packages/ai-budget-ledger/cli.js` | Cycle 94 public-safe budget-status output | `defer-with-task` | Command names and stated exit classes appear preserved; README CLI contract is stale and still describes detailed spend summaries and raw JSON | Retain the fail-closed output intent, but reconcile README wording before declaring this entry point complete. No command ran. |
| `packages/issue-scam-scanner/cli.js` | Intake Guardrail report modes plus quarantine/block thresholds | `retain` | Static review found no new network, wallet, signing, publishing, or decoded-content behavior; documented command and exit-code shapes align with the package README | Keep the future calibration runner as a **separate local entry point** so the scanner CLI stays focused and fixture evidence cannot leak through its normal output path. No scanner command ran. |
| `packages/orbit-mcp-server/bin.js` | Cycle 96 read-only MCP boundary documentation | `retain` | Entrypoint still delegates to the existing stdio server and adds no command, network destination, wallet, signing, or publishing behavior | Static review only; server tests were not run. |
| `packages/orbit-sdk/cli.js` | Cycle 92 public-safe budget command | `defer-with-task` | The `budget` command is status-only, but `status` still serializes `sdk.quickStatus()`, whose current shape includes configured AI-budget amounts from `packages/orbit-sdk/index.js` | Sanitize the `status` view (or its CLI projection) before declaring this entry point complete. Preserve machine-readable SDK internals only where they are not a public output surface. No command ran. |

## Gate result

**Status: blocked on two narrow follow-ups.**

The four files now have explicit dispositions and the calibration runner boundary is settled as a separate local entry point. The reconciliation gate is not yet satisfied because:

1. `packages/ai-budget-ledger/README.md` must match the CLI's public-safe status-only output contract.
2. `packages/orbit-sdk/cli.js status` must not emit detailed AI-budget amounts through `sdk.quickStatus()`.

These are routine repo-local documentation/code fixes and do not require an approval issue. They should be completed as separate small changes, with exact allowlisted tests run only after the code change is ready.

## Validator handoff after reconciliation

Once both follow-ups are complete:

1. Add a pure validator with no filesystem, network, process-exit, or console side effects.
2. Validate manifests and output candidates against `docs/intake-guardrail-action-calibration-runner-schema.json`.
3. Cover the cases in `docs/intake-guardrail-action-calibration-runner-test-cases.md`.
4. Keep scanner execution and fixture loading outside the pure validator.
5. Expose any runner through a separate local entry point, not `packages/issue-scam-scanner/cli.js`.
6. Run only an exact allowlisted test command.
7. Keep calibration evidence and the release decision at `hold` until a reviewed seven-fixture run exists.

## Safety boundary

This cycle performed read-only static inspection and updated this documentation artifact only. It did not alter any CLI, SDK, scanner, or MCP behavior; run a scanner or test command; expose fixture bodies; update calibration rows; authorize release; mark a roadmap phase passed; publish; contact external parties; spend funds; sign; launch or move tokens; claim rewards; change payout routes; or grant access.

## Next step

Apply one narrow public-output fix first: project `orbit status` to a status-only budget label rather than serializing configured budget amounts. Then update the AI Budget Ledger README in a separate documentation change, close the reconciliation task, and implement the pure calibration validator as its own auditable change.
