# SPAWN.md — autonomous repo-spawn capability (S-SPAWN-1)

> Status: drafted + shipped (Patch Set AD).

## 1. Goal

Orbit can autonomously create new repositories under its organization, scaffold a fresh Orbit instance into each, and track the family. The parent does not lose control: every spawn is approval-gated through the existing quorum machinery, every spec is risk-scanned before proposal, and no secrets ever propagate from parent to child.

This turns Orbit from "manages this repo" into "spawns and manages a family of repos" — the founder-fade thesis at one level up.

## 2. Constraints

- **No on-chain action** during spawn — D-018 does not apply. (Children become D-018-gated independently once they launch tokens.)
- **Approval-gated**: every spawn requires a public proposal issue and quorum approval per D-014. Single-maintainer mode defaults to owner-approval-only.
- **No secret leakage**: the parent's `.env`, `secrets/`, wallet keys, AI provider keys, signer addresses MUST NOT be copied into the child's scaffold. The child gets a clean template identical to what `npx create-orbit-house` emits.
- **No arbitrary code generation** in this version — scaffolding uses the existing `packages/create-orbit-house/` templates. Future versions may LLM-generate domain-specific code, but only inside the child's first cycle, never during spawn.
- **Risk scan** every human-supplied field (name, description, rationale) through `scam.scanTextRisk` + the federation risk-pattern allowlist before the proposal is accepted.
- **Name validation**: child repo name matches `^[a-z][a-z0-9-]{1,38}[a-z0-9]$` — GitHub-valid, lowercase-kebab, length-capped.
- **Bidirectional federation handshake** on success: parent records child in `memory/family.json`, child's bootstrap `memory/federation-peers.json` lists the parent.
- **Idempotent**: each spawn has a stable `idemKey`. Re-proposing returns the existing record; never duplicates.

## 3. Lifecycle

| State | Triggered by | What's stored |
|---|---|---|
| `proposed` | `proposeSpawn()` after risk scan | full spec, scan result, proposerUsername, idemKey, createdAt |
| `voting` | first APPROVE/REJECT comment | accumulating approvals + rejections sets |
| `approved` | quorum threshold reached | quorumReachedAt timestamp |
| `executing` | `tickSpawns()` picks up an approved spawn | startedAt |
| `complete` | executor returns `{ok:true, html_url}` | childUrl, childRepoId, executedAt |
| `rejected` | any REJECT during proposed/voting | rejector, rejectedAt |
| `failed` | executor throws | executionError, retryCount |

Quorum semantics reuse `governance.parseQuorumComments` exactly (Patch Set Q hardening — code-fence + blockquote + 4-space-indent skips apply).

## 4. Comment grammar

```
APPROVE ORBIT-SPAWN <idemKey>
REJECT  ORBIT-SPAWN <idemKey>
```

Same line-anchored regex as governance + handoff. Only maintainers count.

## 5. Spec shape

```
{
  type: "product" | "research" | "infrastructure",
  name: "<lower-kebab, 3-40 chars>",
  description: "<short purpose, ≤200 chars>",
  rationale: "<why this exists, ≤2000 chars>",
  visibility: "public" | "private",   // default public
  aiBudgetUsd: { daily: 1, monthly: 20 },
  initialIssues: [
    { title: "first cycle", body: "..." },
    { title: "owner approval label setup", body: "..." }
  ]
}
```

## 6. Failure modes

| Mode | Mitigation |
|---|---|
| Org token missing `Administration: write` | `executeSpawn` reports `PERMISSION_DENIED`; proposal stays in `approved` for retry. |
| Repo name collision | `executeSpawn` reports `NAME_CONFLICT`; operator picks a new name. |
| Rate limit (429) | github.js retry+backoff handles transient. Hard rate-limit -> retry-with-backoff up to 3 attempts. |
| Org out of free private repos | Pre-check at proposal time; reject with `BILLING_LIMIT`. |
| Child failed to bootstrap | parent records `failed` + opens an investigation issue under the parent. |
| Risky spec (drain attempt / encoded payload) | rejected at proposal time before any API call. |

## 7. Frontend surface

- Hero panel adds `family: N` row.
- Inspect adds `spawned projects` cell + recent-spawns table (name | type | status pill | created | link).
- No new top-level route — spawn is part of the inspect data surface.

## 8. Owner action required

For real (non-dry-run) spawn, the operator must provision:

```bash
gh secret set ORBIT_SPAWN_TOKEN --body "ghp_..."   # PAT with `repo` + `admin:org` (or org-scoped GitHub App)
gh variable set ORBIT_SPAWN_ORG --body "orbithousezkp"   # target org
```

Without these, every spawn runs in dry-run: writes to `runtime/spawn/dry/<name>/` for inspection, returns a stub URL. Live spawn refuses to fire.

## 9. Future extensions (not in this patch)

- LLM code generation inside the child's first cycle (using its own AI provider config).
- Cross-repo bounty referral (S-026 → S-SPAWN-2).
- Recursive spawn: a child can spawn grandchildren once its own `preLaunchVerified` flips.
- Family budget pool — parent allocates to children, children report back.
- Cross-family capability marketplace.
