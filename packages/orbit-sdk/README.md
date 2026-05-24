# Orbit SDK

_Part of [Orbit](https://github.com/candyburst/orbit) — the control plane for agent memory and infrastructure inside any GitHub repo._

Read-only SDK for Orbit repository infrastructure.

Orbit SDK lets another repo, agent, CLI, or dashboard read the public control-plane state of an Orbit installation without receiving write authority, wallet authority, provider routes, or secrets.

## What It Exposes

- Agent passport and product identity
- Infrastructure layers and access surfaces
- Capability registry and command surface
- Permission and approval policy
- Read-only wallet policy, AI-call budget, revenue cadence, and token state
- Lifecycle state and latest cycle
- Proof receipt summaries and digests
- Task and durable-memory summaries
- Adoption/install checklist

## Usage

```js
const { createOrbitClient } = require("@orbit-house/sdk");

const orbit = createOrbitClient({ repoRoot: "/path/to/orbit-repo" });

console.log(orbit.readStatus());
console.log(orbit.readPassport());
console.log(orbit.readInfrastructure());
console.log(orbit.readWalletPolicy());
console.log(orbit.readReceipts({ limit: 5 }));
```

CLI:

```bash
node packages/orbit-sdk/cli.js status
node packages/orbit-sdk/cli.js infrastructure
node packages/orbit-sdk/cli.js wallet
node packages/orbit-sdk/cli.js adoption --json
node packages/orbit-sdk/cli.js bundle --repo /path/to/orbit
```

## Exports

- `createOrbitClient({ repoRoot, paths? })` — main entry; returns a bound client with every reader below.
- `readStatus(opts)` — product + lifecycle status snapshot.
- `readPassport(opts)` — agent passport and product identity.
- `readInfrastructure(opts)` — infrastructure layers and access surfaces.
- `readCapabilities(opts)` — capability registry and command surface.
- `readPermissions(opts)` — approval and blocked-action policy.
- `readWalletPolicy(opts)` — read-only wallet policy and budget caps.
- `readLifecycle(opts)` — wake/sleep state and latest cycle.
- `readReceipts(opts)` — proof receipt summaries and digests.
- `readMemorySummary(opts)` — task and durable-memory summary.
- `adoptionChecklist(opts)` — install/adoption checklist.
- `projectForDashboard(opts)` — public dashboard projection of all of the above.
- `exportBundle(opts)` — single bundle containing every read above.
- `DEFAULT_PATHS` — default repo-relative file paths the client reads from.

## Boundary

This package reads local public repository files only. It does not execute commands, mutate files, call GitHub, call models, sign transactions, or expose private routes.
