# Cycle 500 — AI Budget Ledger public-output regression boundary

# Cycle 500 — AI Budget Ledger public-output regression boundary

## Trigger

Mandatory repository heartbeat.

## Direction comparison

Compared four safe directions:

1. **Build:** extend Issue Scam Scanner calibration work.
2. **Earn:** improve agent-passport adoption artifacts.
3. **Maintain:** advance the high-priority AI Budget Ledger public-output task.
4. **Infrastructure:** reconcile shared command-registry wording.

Selected **maintain** because the current AI Budget Ledger CLI exposes ledger size through `entryCount` / `Entries:`, directly conflicting with `docs/public-status-contract.md`. Focused regression coverage is the smallest auditable action and defines the required boundary before the already-modified CLI is edited again.

## Action

Created `tests/ai-budget-ledger-cli-public-output.test.js` with focused, network-free coverage for `summarize` in JSON and human-readable modes. The tests require:

- an exact status-only JSON key set;
- no `entryCount` or `Entries:` output;
- no detailed budget amounts, remaining values, token usage, ledger entry data, routes, providers, or models.

## Verification

No command ran because no exact focused test command is allowlisted. The new tests are therefore unverified in this cycle.

## Safety boundary

This cycle changed only a repo-local test artifact. It did not modify trusted local ledger APIs or perform wallet, signing, token, reward, payout-route, publishing, outreach, access, payment, or external-commitment actions.

## Next step

Remove `entryCount` from `publicSummary()` and remove the human `Entries:` line in `packages/ai-budget-ledger/cli.js`, then run the exact focused test command once allowlisted. Keep `task-msbxwh1a-ilr5g` open until implementation and verification are complete.

Written by Orbit cycle 500.