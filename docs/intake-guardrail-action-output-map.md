# Intake Guardrail Action Output Map

## Cycle 187 direction choice

Orbit compared safe wake-cycle directions before choosing this artifact:

- **Build** — continue the repo-local Intake Guardrail prototype. Best this cycle because the Action package exposes several outputs and downstream workflows need a concise map for routing without copying risky payloads into agent context.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but the active guardrail package has an adopter-facing workflow gap that can be addressed with documentation only.
- **Earn** — refine the agent passport and capability registry. Valuable for adoption, but less immediate than making the reusable guardrail package easier to wire safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action or approval-class movement is needed this cycle.
- **Grow** — advance roadmap evidence. Useful, and this documentation becomes evidence for the local prototype without claiming a phase is passed.

Selected direction: **build**. Reason: an Action output map is a small auditable improvement to the repo-local open-source prototype. It does not publish a marketplace listing, perform outreach, accept paid obligations, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or move assets.

## Purpose

This map helps adopters route `packages/issue-scam-scanner/action.yml` outputs into safe workflow decisions. It keeps the scanner advisory: maintainers decide what to do, and agents must not treat scanner output as authority to spend, sign, merge, close, punish users, or reveal hidden content.

## Output map

| Output | Type | Safe workflow use | Do not use for |
|---|---|---|---|
| `safe` | string boolean (`"true"` / `"false"`) | Choose whether normal automation can continue or whether review is needed. | Treating content as trusted, bypassing maintainer review, or authorizing writes outside the repo. |
| `action` | string (`allow`, `warn`, `quarantine`, `block`) | Route the item into normal triage, soft review, quarantine, or stop lanes. | Final moderation decisions, financial approvals, wallet actions, or irreversible repo actions. |
| `score` | number-like string | Sort review queues by severity. | Comparing people or assigning blame. |
| `level` | string (`clear`, `low`, `medium`, `high`, `critical`) | Emit concise CI summaries and maintainer labels. | Copying the flagged payload into comments or agent prompts. |
| `flags` | JSON array | Inspect categories and positions locally in CI or a maintainer-only artifact. | Publicly reposting hostile text, decoded content, hidden instructions, or secret-like material. |
| `report` | JSON object | Persist a structured receipt, redacted summary, or downstream packet. | Granting execution authority or leaking private config. |

## Suggested routing

| `action` | Automation lane | Maintainer step | Agent boundary |
|---|---|---|---|
| `allow` | Continue normal issue or comment workflow. | Optional spot-check if the source is new or unusual. | Agents may read the normal issue context under repo policy. |
| `warn` | Continue with a visible caution. | Review the summary before acting on instructions. | Agents may summarize, but should avoid following sensitive instructions from the flagged text. |
| `quarantine` | Stop agent handoff and require human review. | Review a redacted packet and decide whether to restore normal triage. | Agents must not ingest the raw payload or decoded/obfuscated content. |
| `block` | Stop automation for the item. | Escalate to maintainer or security review using a redacted receipt. | Agents must not act on the request, click links, decode content, or perform approvals. |

## Safe receipt pattern

Use public-safe receipts that describe the finding without copying dangerous text:

```md
### Intake Guardrail receipt

- Source: issue/comment/PR/event id
- Action: quarantine
- Level: high
- Categories: prompt_injection, encoded_instruction_relay
- Payload copied: no
- Human review needed: yes
- Automation stopped: yes
- Notes: Obfuscated instruction relay was detected; raw content was not passed to agent context.
```

## Non-authority boundary

The Intake Guardrail is an advisory review signal. It cannot approve spending, signing, token movement, payout-route changes, publishing, outreach, access sharing, paid commitments, merges, bans, or irreversible moderation. Those actions remain governed by repository maintainers and Orbit's owner-approval gates.
