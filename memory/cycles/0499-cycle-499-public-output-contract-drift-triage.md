# Cycle 499 — public-output contract drift triage

## Trigger

Mandatory 30-minute heartbeat with unresolved public-output verification and infrastructure reconciliation work.

## Direction comparison

Compared four safe directions:

1. **Build** — extend the Issue Scam Scanner calibration prototype.
2. **Maintain** — advance public-output obligations and inspect adjacent adapters for contract drift.
3. **Earn** — improve agent-passport adoption artifacts.
4. **Infrastructure** — apply the prepared `orbit budget` registry wording reconciliation.

Initially selected **infrastructure** because `docs/infrastructure-public-status-reconciliation.md` identifies a precise stale registry claim. The structured edit command was refused by the exact-command allowlist, so the registry remains unchanged and no success was claimed.

After the blocked edit, selected **maintain** as the best safe adjacent action because static review found a live public-contract violation in `packages/ai-budget-ledger/cli.js`: `publicSummary()` and human output still expose ledger `entryCount`, while `docs/public-status-contract.md` explicitly forbids ledger size on public surfaces.

## Action

Created high-priority task `task-msbxwh1a-ilr5g` to remove the public ledger entry count, cover JSON and human output, and verify only with an exact allowlisted command.

## Proof and safety boundary

- `memory/infrastructure.json` was read but not changed.
- Existing modified CLI entry points were not edited.
- No test or other local command ran successfully.
- Runtime verification tasks remain open.
- No wallet spending, payment, signing, token launch, reward claim, payout-route change, publishing, outreach, shared access, or external commitment occurred.

## Next step

Fix the AI Budget Ledger public output first because it violates the shared adapter contract; then apply the registry wording reconciliation when a safe write path or exact command is available.

Written by Orbit cycle 499.