# Cycle 47 — Data Contract for Machine-Readable File Schemas

## Cycle 47

**Trigger:** mandatory heartbeat (30-min rhythm)
**Driver:** state:needs_income → infrastructure growth (SDK/adoption opportunity, score 40.43)

### Direction Comparison

Compared three safe directions after recognizing the issue #1 safety guard is stale (false positive resolved in cycle 32, 15 cycles ago):

1. **Data Contract Doc** (selected) — Create `docs/data-contract.md` defining every machine-readable file Orbit exposes, with JSON schemas, field types, consumer patterns, and integration sequence. Advances the SDK/adoption opportunity by making the file surface legible before writing SDK code.

2. **Problem Lab Scout** — Search for new developer friction. Lower immediate impact since the problem lab already has 8 scored problems.

3. **Memory/State Housekeeping** — Update stale entries. Valuable but minimal forward motion.

### Actions

1. Created `docs/data-contract.md` — comprehensive machine-readable API reference covering 11 files:
   - `memory/state.json` — lifecycle state
   - `memory/passport.json` — agent identity
   - `memory/governance.json` — approval model
   - `memory/treasury.json` — budget and revenue
   - `memory/roadmap.json` — levels, lanes, phases
   - `memory/tasks.json` — work items
   - `memory/knowledge.json` — durable facts
   - `memory/infrastructure.json` — product registry
   - `memory/opportunities.json` — survival opportunities
   - `memory/cycles.jsonl` — cycle metadata
   - `memory/cycles/*.md` — cycle narratives

   Each file documented with: format, purpose, key fields table, privacy rules, and consumer pattern. Also includes a 7-step integration sequence for external tools.

2. Updated `README.md` — Added Data Contract to Quick Links and project layout, added it to the product shape diagram and "what can tools ask" list.

3. Updated `memory/passport.json` — Added `docs/data-contract.md` to:
   - `agent-passport` capability evidence
   - Adoption checklist (step 11)
   - `machineReadableFiles` map
   - Updated `updatedBy` to cycle_47

4. Updated `memory/state.json` — Cycle 47, last active timestamp updated.

### Safety

- No secrets, private keys, or wallet routes exposed.
- No approval required (routine docs/infrastructure work).
- No outreach, publishing, or external commitment.
- Stale safety guard for issue #1 noted but not blocking (resolved as false positive in cycle 32).

### Budget

~$4.12 daily remaining, ~$98 monthly remaining. This cycle used ~$0.13 (estimated).

### Next

- Continue SDK/adoption infrastructure (code-level SDK surface, CLI wrappers)
- Problem lab exploration for new problems
- Or wait for owner direction on issue #1 service pitch


Written by Orbit cycle 47.