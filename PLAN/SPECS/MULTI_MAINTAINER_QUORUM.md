# Multi-Maintainer Quorum — Spec (v1)

**Session:** S-029 / S-030
**Phase:** 3 → 4 transition
**Status:** SHIPPED (additive to governance core)
**Owner:** Orbit core
**Supersedes:** none

> This document specifies how Orbit moves from solo-owner approval (D-014) to a multi-maintainer quorum without breaking the existing solo-owner default. Implementation lives additively in `src/agent/governance.js` and `src/agent/config.js`. The existing `tests/governance.test.js` suite is unchanged.

---

## 1. Goal

Until S-029, every D-014-class on-chain or risky action required exactly one human's approval comment — the configured `ORBIT_OWNER_USERNAME`. That key-of-one model is fine for bootstrap, but it can't survive past Phase 3:

- A single owner is a single point of failure (key loss, account compromise, founder-becomes-unavailable).
- A handoff narrative (S-035) is meaningless if the destination is also one person.
- Federation trust decisions (S-021) and treasury moves (D-017) deserve more than one set of eyes.

Quorum is the smallest possible upgrade: when `ORBIT_MAINTAINERS` is set, approval becomes "K of N maintainers commented APPROVE" instead of "one specific user commented APPROVE." When the env var is absent, every existing behavior, every existing test, and every existing approval flow stays exactly as it is.

## 2. Constraints

- **github-only** — quorum signal is GitHub issue comments. No off-platform vote system.
- **No on-chain action without approval per D-014** — quorum is the new shape of the same gate, never a bypass.
- **Backward compat** — solo-owner mode is the default; the existing `tests/governance.test.js` must keep passing **unmodified**.
- **Additive only** — no rename or removal of any existing export from `governance.js` or `config.js`.
- **One REJECT terminates** — a single REJECT comment from any maintainer ends the proposal immediately, regardless of approval count.
- **Per-action threshold** — `low` requires 1 approval, `medium` requires 2, `high` requires `floor(N/2)+1` (simple majority), `critical` requires all N maintainers.

## 3. Configuration

`config.quorum` is computed at load time from `ORBIT_MAINTAINERS` (CSV) plus `ORBIT_OWNER_USERNAME`.

```js
config.quorum = {
  enabled: boolean,              // true iff maintainers.length > 1
  maintainers: string[],         // lowercased, deduped, owner always included
  owner: string,                 // ORBIT_OWNER_USERNAME, lowercased
  thresholds: {
    low: 1,
    medium: min(2, N),
    high: floor(N/2) + 1,
    critical: N
  }
}
```

Threshold table:

| N | low | medium | high | critical |
|---|-----|--------|------|----------|
| 1 |  1  |   1    |   1  |    1     |
| 2 |  1  |   2    |   2  |    2     |
| 3 |  1  |   2    |   2  |    3     |
| 5 |  1  |   2    |   3  |    5     |

When `quorum.enabled === false`, the existing solo-owner check from `commentApproves` runs unchanged. There is no behavioral change for any deployment that does not set `ORBIT_MAINTAINERS`.

## 4. Action tiers

`actionTier(actionType)` is the single source of truth for "how risky is this action":

| Action | Tier | Why |
|---|---|---|
| `buyback` | high | Treasury outflow. Majority signoff required. |
| `merkle-anchor` | medium | On-chain but receipt-only. Two-of-anyN is safe. |
| `handoff` | critical | Founder share rotation. Unanimous. |
| `federation-trust` | high | Adding a peer is a security boundary. |
| `treasury-deploy` | high | Safe deploy is a one-time, expensive op. |
| _(default)_ | medium | Anything not in the table is treated as medium. |

`low` exists in the threshold table but no built-in action currently maps to it; it's reserved for trivial settings (telemetry opt-ins, public dashboard rebuilds) that future sessions may add via additive table entries.

## 5. Comment grammar

A maintainer vote is a standalone line matching:

```
APPROVE ORBIT-{ACTION-TOKEN} {idem}
REJECT  ORBIT-{ACTION-TOKEN} {idem}
```

- `ACTION-TOKEN` is the action type uppercased with non-alphanumeric chars collapsed to `-` (e.g. `BUYBACK`, `MERKLE-ANCHOR`, `HANDOFF`).
- `idem` is the action's idempotency key — the same string the action issue body publishes for that proposal.
- Authors are lowercased before comparison.
- Same author voting twice → one vote (de-duped via a `Set`).
- Author not in `quorum.maintainers` → vote ignored.
- Vote line for a different `idem` → not counted (idem isolation).

## 6. Evaluation

`evaluateQuorum({ comments, idemKey, actionTier, quorum })` returns exactly one of:

```
{ status: "disabled" }                                      // quorum.enabled === false → fall back to solo
{ status: "rejected", rejector, reason, ... }               // any maintainer REJECT
{ status: "approved", approvals: Set, threshold, total }    // approvals.size >= threshold[tier]
{ status: "pending",  approvals, rejections, needed, ... }  // otherwise
```

A REJECT comment is final the instant it's seen — even if N–1 maintainers have already APPROVED. There is no "withdraw your rejection" comment; if a maintainer changes their mind they must open a fresh proposal with a new `idem`.

## 7. requiresQuorum semantics

`requiresQuorum(actionType, quorum)` is true iff:

1. `quorum.enabled === true`, AND
2. `actionTier(actionType) !== "low"`, AND
3. `quorum.maintainers.length > 1`.

So a `critical` action under a degenerate single-maintainer config still routes through the existing solo path. The system gracefully degrades, never escalates.

## 8. D-014 alignment

| Aspect | Solo mode (today) | Quorum mode (this spec) |
|---|---|---|
| Approval issue | created by `requestOwnerApproval` | unchanged |
| Approval comment | `APPROVE ORBIT-SPEND {id}` from one owner | `APPROVE ORBIT-{ACTION} {id}` from K maintainers |
| Rejection | one REJECT from owner | one REJECT from any maintainer |
| Idempotency | `stableFingerprint(request)` | unchanged (idem is reused) |
| Local store | `memory/approvals.json` | unchanged |

The quorum module does not write to `memory/`. It is a pure evaluator over the comment stream — the existing approval-store updates (in `checkOwnerApproval`) continue to own persistence.

## 9. Failure modes

1. **Maintainer key compromise** → a hostile actor controls one vote; they cannot force approval (need K), they CAN force rejection (one REJECT terminates). Mitigation: the comment grammar requires the exact action token + idem, so blanket REJECT-spam is detectable; future sessions can add a "REJECT requires rationale" linter, but v1 accepts the rejection at face value.
2. **Maintainer list drift** → if a maintainer's GitHub username is renamed, the lowercased match misses. Mitigation: maintainers should re-set `ORBIT_MAINTAINERS` on any rename; the env value is canonical.
3. **Vote on stale idem** → idem isolation ensures votes for a previous proposal don't roll forward.
4. **Race on threshold flip** → no race: evaluation is over the complete comment list at check time; if a new APPROVE lands the same cycle that a REJECT lands, REJECT wins (terminal-rejection rule).
5. **Founder solo-bypass attempt** → can't happen: when `ORBIT_MAINTAINERS` is set, even the configured owner is one of N. There is no "founder override" path.

## 10. Test plan

`tests/governance-quorum.test.js`, ≥15 tests:

- `computeThresholds` lookup table verified for N ∈ {1, 2, 3, 5}.
- `actionTier` mapping for buyback / handoff / merkle-anchor / federation-trust / treasury-deploy / unknown.
- `parseQuorumComments` dedupes same-user double votes.
- `parseQuorumComments` ignores non-maintainer votes.
- `parseQuorumComments` enforces exact-idem match.
- `evaluateQuorum` returns `pending` with zero votes.
- `evaluateQuorum` returns `approved` at threshold.
- `evaluateQuorum` returns `rejected` even with approvals present.
- `evaluateQuorum` ignores rejection from non-maintainer.
- `evaluateQuorum` returns `disabled` when `quorum.enabled === false`.
- `requiresQuorum` low-tier escape hatch returns false.
- `requiresQuorum` single-maintainer degrades to solo path.
- Idem isolation: votes for different idems don't cross-count.
- `parseMaintainers` / `buildQuorum` / `loadConfig` round-trips.

Existing `tests/governance.test.js` is **not modified**. It must continue to pass with zero changes.

## 11. Cross-references

- `PLAN/SPECS/FOUNDER_HANDOFF.md` — depends on this spec (S-035 requires quorum live).
- `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md` — Safe signer rotation surfaces critical-tier actions through this gate.
- `PLAN/SPECS/FEDERATION.md` — peer add/evict decisions become high-tier under quorum mode.
- `PLAN/DECISIONS.md` — D-014 (no on-chain without approval), D-017 (Safe holds treasury), D-018 (token launch gates).

## 12. Future work

- **S-036+** Optional "weighted quorum" where stake-holding maintainers get more weight. v1 is one-maintainer-one-vote.
- **S-037+** Rationale linter on REJECT comments (require a one-line reason after the vote).
- **Phase 4** Multi-action batched approvals (a single comment approves a list of related idems) — out of scope for v1 to keep the comment grammar trivially auditable.
