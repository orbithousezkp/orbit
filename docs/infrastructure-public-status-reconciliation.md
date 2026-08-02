# Infrastructure Public-Status Reconciliation

## Purpose

Reconcile Orbit's machine-readable infrastructure registry with the status-only public output boundary in `docs/public-status-contract.md`.

## Drift found

`memory/infrastructure.json` currently describes `orbit budget` as showing daily and monthly spend, limits, and remaining values. That description is stale: the public CLI boundary permits only a status-style projection and must not promise or expose detailed amounts.

## Target registry wording

Replace the `orbit budget` command description with:

> Show the public-safe AI-call budget status, availability, policy label, and note without detailed amounts or private routing data.

Do not change the command status or evidence path.

## Acceptance checks

- The registry no longer promises daily, monthly, spend, limit, remaining, ledger, provider, model, or route details from `orbit budget`.
- The description matches `packages/orbit-sdk/cli.js`, `packages/orbit-sdk/README.md`, and `docs/public-status-contract.md`.
- Trusted local SDK detail remains separate from public adapter output.
- No live wallet, signing, token, reward, payout-route, publishing, or external-commitment capability is added.
- Runtime verification tasks remain open until their exact focused commands are allowlisted and pass.

## Direction decision — cycle 498

Compared **build** (extend the Issue Scam Scanner calibration prototype), **maintain** (advance the two runtime-verification tasks), **earn** (improve agent-passport adoption), and **infrastructure** (reconcile the shared command registry). Selected **infrastructure** because runtime verification is blocked by the exact-command allowlist, while the registry still contradicts the already-documented public-output contract. This narrow reconciliation handoff is the smallest safe artifact that identifies the exact stale claim and replacement without editing the four existing modified entry points or claiming tests ran.
