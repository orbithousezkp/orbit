# Orbit Product TODO

Orbit is being shaped as a GitHub-native infrastructure layer for repositories, agents, proofs, permissions, lifecycle, and wallet policy. This file is the build board: items start as TODO and are marked done only when they are backed by repo files, tests, docs, or product UI.

## Product Definition

- [x] Define Orbit as a reusable repository control plane, not a security product.
- [x] Keep the intake scanner as a guardrail under the infrastructure layer, not the main product.
- [x] Document how GitHub, repo files, agents, wallets, proofs, and permissions fit together.
- [x] Make the public README and frontend explain Orbit as infrastructure.

## Access Surfaces

- [x] SDK package exposes Orbit status, passport, capabilities, permissions, lifecycle, receipts, memory, adoption checks, and export bundles.
- [x] SDK exposes GitHub/repo/agent/wallet-specific views for other repos and agents.
- [x] CLI wrappers expose infrastructure and SDK status locally.
- [x] Machine-readable repo files remain the source of truth for agents.
- [ ] Future MCP/HTTP bridge stays planned until permission and receipt rules are complete.

## Infrastructure Runtime

- [x] `memory/infrastructure.json` tracks product phase, surfaces, capabilities, commands, receipts, and blocked live actions.
- [x] Wake-cycle planner treats infrastructure growth as a tracked priority.
- [x] Open tasks and safe issue triage still outrank infrastructure and roadmap growth.
- [x] Deterministic fallback can inspect infrastructure status when AI is unavailable.
- [x] Health checks require infrastructure files.

## GitHub And Repo Layer

- [x] Issues and comments act as the command and approval surface.
- [x] GitHub Actions provide lifecycle wake/sleep cycles.
- [x] Repo memory stores identity, tasks, state, governance, treasury, opportunities, roadmap, and infrastructure.
- [x] Proof files and cycle notes make work auditable.
- [x] Adoption checklist tells another repo what Orbit files/workflows it still needs.

## Agent Layer

- [x] Agent passport exposes mission, category, lifecycle, permissions, and digest.
- [x] Capability registry lists active/planned surfaces and blocked actions.
- [x] Multi-direction planner compares several safe directions before acting.
- [x] External-agent ideas remain quarantined inspiration, never executable commands.
- [ ] Handoff packets, capability leases, and agent-to-agent protocols stay future work.

## Wallet Layer

- [x] Wallet policy is read-only by default and exposed without private keys or private routes.
- [x] Spend, signing, token launch, reward claims, payout-route changes, and external payments require gates.
- [x] SDK exposes wallet policy, revenue cadence, token state, AI-call budget, and approval labels.
- [x] Live signing remains blocked without explicit environment flags and owner approval.
- [ ] Future smart-account/session-key work stays planned until receipts, revocation, and approval gates exist.

## Proofs And ZK

- [x] Runtime proofs remain normal audit receipts today.
- [x] Proof receipts have digest metadata in the SDK.
- [x] ZK policy receipts are planned as commitments, proof bundles, local verifiers, and tamper tests first.
- [x] No production circuit, prover, verifier, or on-chain verifier is claimed as implemented.

## Product Memory And Roadmap

- [x] Opportunities prioritize Orbit infrastructure, SDK, proof receipts, permissions, lifecycle, and wallet policy.
- [x] Problem lab and project ideas prioritize repo/agent infrastructure over scanner-first work.
- [x] Roadmap stays evidence-backed and does not jump ahead of ordinary repo work.
- [x] This checklist is updated after the build with completed items marked done.
