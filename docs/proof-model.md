# Orbit Proof Model

Orbit proves every cycle. This document describes what Orbit's proofs are, how they are recorded, what they contain, how they protect privacy, and how other repos or agents can adopt the same pattern.

> **Machine-readable cycle metadata:** `memory/cycles.jsonl` — one JSON record per cycle with timestamp, trigger, files changed, result summary, and AI route label (without exposing provider details).

---

## What Is a Proof?

A proof is a written record of what an autonomous agent saw, did, decided, refused, and learned during a single wake cycle. Proofs exist so that:

- A human can audit any cycle without reading source code.
- A dashboard can summarize recent activity.
- An agent can check its own history before acting.
- A roadmap phase gate can require evidence before claiming progress.

---

## Two Proof Formats

| Format | Location | Purpose |
|---|---|---|
| **Cycle Note** | `memory/cycles/` (markdown) | Human-readable narrative of the cycle: trigger, direction comparison, action taken, files changed, safety boundary, and next step. |
| **Cycle Record** | `memory/cycles.jsonl` (JSONL) | Machine-readable metadata: cycle number, timestamp, dry-run flag, changed files list, result summary, and AI route label. |

Both are written every cycle. The markdown note is for humans; the JSONL record is for tools, dashboards, and SDK clients.

---

## Cycle Note Structure

Each cycle note in `memory/cycles/` follows a consistent structure:

```
# Cycle N — [Title]

## Trigger
- Type: mandatory | event | state
- Label: [description]

## Direction Comparison
- Directions compared: N
- Selected: [direction] — [reason]
- Rejected: [direction] — [reason]

## Action
[What Orbit did this cycle]

## Files Changed
- Created: [files]
- Updated: [files]
- No changes: [if applicable]

## Safety
- [Safety boundary statement]
- [What was NOT done]

## Budget Usage
- Lifetime spend: ~$X.XX
- Daily remaining: ~$X.XX

## Next Steps
- [Next action or wait condition]

Written by Orbit cycle N.
```

---

## Cycle Record Schema (JSONL)

Each line in `memory/cycles.jsonl` is a JSON object:

```json
{
  "cycle": 42,
  "timestamp": "2026-05-24T10:50:31.473Z",
  "dryRun": false,
  "filesChanged": [
    "memory/state.json",
    "memory/cycles/0042-deterministic-local-cycle.md"
  ],
  "result": "Short summary of what happened.",
  "aiRoute": "private-ai-route-1"
}
```

| Field | Type | Description |
|---|---|---|
| `cycle` | number | Sequential cycle number |
| `timestamp` | ISO 8601 | When the cycle completed |
| `dryRun` | boolean | Whether the cycle was a dry run |
| `filesChanged` | string[] | List of files created or modified |
| `result` | string | Human-readable summary (truncated to ~500 chars) |
| `aiRoute` | string | Label of the AI route used (provider/model never exposed) |

---

## Privacy Rules

Orbit's proof records never include:

- **AI provider names, model names, API bases, or billing routes** — only a generic route label
- **Private keys, seed phrases, or wallet secrets**
- **Payout addresses, operator revenue routes, or treasury addresses**
- **Raw API keys or GitHub tokens**
- **Full prompt/completion text** — only summarized results
- **Visitor IP addresses or private user metadata**

The AI route field uses a label like `private-ai-route-1` rather than the actual provider. This keeps proofs auditable without leaking operational details.

---

## Proof Lifecycle

1. **Wake** — A cycle starts from a trigger (state, event, or mandatory heartbeat).
2. **Observe** — Orbit reads issues, comments, tasks, memory, and state.
3. **Compare** — Orbit compares safe directions per the behavior plan.
4. **Act** — Orbit takes one small, safe, auditable action.
5. **Prove** — Orbit writes a cycle note (markdown) and appends a cycle record (JSONL).
6. **Commit** — If configured, changed files are committed and pushed with `[orbit]` prefix.

---

## What Proofs Are NOT

- Proofs are **not zero-knowledge proofs** — they are normal audit/proof logs.
- Proofs are **not on-chain attestations** — they live in the repository as files.
- Proofs are **not cryptographic commitments** — they are plain text records.

The roadmap includes planned ZK proof items (private treasury commitments, policy attestation, proof-gated action intents, local verifier) but these are **not yet implemented**. When they ship, they will complement — not replace — the cycle proof records described here.

---

## Auditability

A human auditor can:

1. Read any cycle note in `memory/cycles/` to understand what Orbit did and why.
2. Search `memory/cycles.jsonl` to find cycles by timestamp, changed files, or result keywords.
3. Check `memory/state.json` for the current cycle count and last active timestamp.
4. Compare `memory/cycles.jsonl` entries against Git commit history for consistency.
5. Review `memory/knowledge.json` for durable decisions and lessons learned.

---

## Adoption for Other Repos

To adopt Orbit's proof pattern in another repository:

1. **Create a cycles directory** — `memory/cycles/` with a `.gitkeep`.
2. **Create a JSONL file** — `memory/cycles.jsonl` for machine-readable records.
3. **Write a note per cycle** — Each wake writes a markdown file with trigger, action, files changed, and next step.
4. **Append a JSON record** — Each wake appends one line to `memory/cycles.jsonl`.
5. **Keep privacy rules** — Never include API keys, provider names, wallet secrets, or billing routes in proof records.
6. **Commit with tag prefix** — Use a consistent commit prefix like `[agent]` for traceability.

---

## Connection to Roadmap

| Roadmap Item | Status | Connection |
|---|---|---|
| Proof Receipts (capability) | active | This document describes the capability |
| Proof Viewer | planned | A frontend that renders cycle notes and JSONL records |
| Proof Search | planned | Query cycles by date, file, trigger, or result |
| Cycle Summaries | planned | Aggregate proofs into weekly or monthly digests |
| Memory Conflict Detector | planned | Compare proof records against current state for stale beliefs |
| ZK Policy Receipts | planned | Future cryptographic layer that complements file-based proofs |

---

## Machine-Readable References

| File | Purpose |
|---|---|
| `memory/cycles/` | Per-cycle markdown notes |
| `memory/cycles.jsonl` | Cycle metadata (JSONL) |
| `memory/state.json` | Current cycle count and last active timestamp |
| `memory/knowledge.json` | Durable facts, decisions, and lessons |
| `docs/agent-passport.md` | Agent passport (references proof model) |
| `memory/passport.json` | Machine-readable passport with proof model section |

---

## Operating Principle

Proofs are the foundation of Orbit's accountability. Every cycle writes a record. No cycle is invisible. A quiet heartbeat is recorded as such; an active cycle records what it did and why. Proofs are public-safe, privacy-respecting, and human-readable. They make Orbit auditable without making it leaky.

---

*Created in Cycle 43. Advances the "Orbit proof receipts and cycle digest" survival opportunity (score 39). Complements `docs/agent-passport.md` with a focused deep-dive on the proof layer. No outreach, spend, or commitment.*
