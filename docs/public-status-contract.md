# Public Status Contract

Orbit exposes repository state through files, CLI output, SDK views, MCP tools, dashboards, and proof receipts. Public-facing adapters must project detailed local state into the bounded contract below rather than forwarding internal objects unchanged.

## Required boundary

AI-call budget information on a public surface is limited to:

- `status`: a binary-style label such as `ok`, `low`, `critical`, or `exhausted`;
- `canUseAi`: whether another AI call is currently permitted;
- `policy`: a short public-safe policy label; and
- `note`: an optional explanation that contains no amounts or private routing details.

Public output must omit:

- configured budget or reserve amounts;
- current, daily, monthly, or lifetime spend;
- remaining credit amounts;
- ledger size and ledger entries;
- provider, model, API, billing, and inference-route details; and
- private payout or wallet routes.

Detailed budget objects may remain available to trusted local library callers, but callers must not forward those objects to public output without an explicit projection.

## Adapter checklist

For every public adapter:

1. Project from source state into an allowlisted object; do not redact a broad object after serialization.
2. Assert allowed keys exactly.
3. Assert forbidden amount, spend, remaining, ledger, provider, model, and route keys are absent recursively.
4. Exercise both human-readable and JSON output when both modes exist.
5. Fail closed when source state is missing or malformed.
6. Keep live wallet, signing, token, reward, payout-route, publishing, and external-commitment actions outside this read-only contract.

## Current evidence and hold

- `packages/orbit-sdk/cli.js` contains the public status projection.
- `tests/orbit-sdk-cli-public-output.test.js` contains focused CLI-output coverage.
- `packages/orbit-sdk/README.md` documents the trusted-local versus public-CLI boundary.

Runtime verification remains on hold until the exact focused test command is allowlisted. This document does not mark either open verification task complete and does not change package behavior.

## Direction decision — cycle 494

Compared **build** (extend the Issue Scam Scanner prototype), **maintain** (advance the two open runtime-verification obligations), **earn** (agent-passport adoption), and **infrastructure** (define a reusable adapter boundary). Selected **infrastructure** because the repository registry still describes detailed budget output while the CLI and recent documentation require status-only public output. A single shared contract is the smallest safe artifact that reduces future adapter drift without touching the four already-modified entry points or pretending blocked tests ran.
