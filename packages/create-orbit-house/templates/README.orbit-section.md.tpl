<!-- orbit:start -->

## Orbit

This repo runs an Orbit agent named **{{AGENT_NAME}}**.

Orbit is a GitHub-native control plane: scheduled and event-driven Actions wake the agent, memory files preserve state across runs, governance rules gate spending, and signed proofs receipt every cycle.

- Cycles run on a 30-min cron (`.github/workflows/orbit-cycle.yml`) and on issue/comment events (`.github/workflows/orbit-event.yml`).
- State lives under `memory/` and proofs under `runtime/proofs/`.
- Governance and wallet policy: `memory/governance.json` and `memory/treasury.json`.
- Owner approval is required for external spend, signing, and token actions.

Set the required GitHub Secrets and Variables (see `.env.example`) before the first cycle.

<!-- orbit:end -->
