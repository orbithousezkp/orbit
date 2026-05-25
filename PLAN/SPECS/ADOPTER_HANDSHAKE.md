# ADOPTER_HANDSHAKE.md — Adopter Tracking Protocol (S-ADP-1)

> Spec for how Orbit detects, verifies, and re-verifies adopter repos against the Phase 1 ≥5 / Phase 5 ≥50 targets in `PLAN/PHASES.md`. No on-chain action; no service to host; entirely GitHub-native.

## 1. Goal

The Phase 1 exit criterion *"≥1 second adopter repo running Orbit"* and the Phase 5 win condition *"≥50 adopters + ≥3 spec implementations"* both need a measurable definition. This protocol converts those criteria into a **mechanically verifiable count** rendered on the public dashboard, replacing the manual `PLAN/ADOPTERS.md` table as the registry of truth.

## 2. Trust model

The mechanism is the **lineage backlink**. An adopter advertises lineage in their own `/.well-known/orbit.json`:

```json
"lineage": {
  "parent": "orbithousezkp/orbit",
  "adoptedAt": "2026-05-25T...",
  "scaffolderVersion": "0.1.0"
}
```

A claim "I'm `<repo>` and I scaffolded from you" is verified by fetching the claimed repo's public well-known and confirming that `lineage.parent === ours` AND `identity.repo === claimed repo`. Both fields require write access to the claimed repo's GitHub Pages surface — which is exactly what a real adopter has and a fraudster does not. No cryptographic signature is required at handshake time; the lineage backlink is the proof.

## 3. The "adopted" status

A registered adopter is marked `adopted: true` only when **all three** criteria pass on the most recent re-verification:

1. **`cycle7d`** — their dashboard's `lifecycle.lastActive` (or well-known's `generatedAt`) is within the last 7 days
2. **`dashboardReachable`** — `${publicUrl}/dashboard.json` returns a parseable JSON
3. **`wellKnownValid`** — well-known parses and still validates (lineage still points back)

Any one failing flips `adopted` to `false`. Re-verification runs every cycle.

## 4. Handshake flow

**Adopter side** (one-time, manual trigger via `gh workflow run orbit-onboard.yml`):

```
1. Read memory/orbit-lineage.json
2. If handshakeOptedIn=false: nothing to do.
3. If handshakeStatus=pending:
   a. Build the handshake issue body with repo URL, well-known URL,
      scaffolder version.
   b. If ORBIT_MOTHERSHIP_PAT secret is set:
        gh issue create --repo <parent> --label orbit:adopter-handshake
      Otherwise:
        Print the body to workflow logs with instructions to paste
        manually at https://github.com/<parent>/issues/new
   c. Update handshakeStatus → "sent" (manually for now).
```

**Mothership side** (every cycle, `src/agent/adopters.js`):

```
1. List own open issues; filter for label orbit:adopter-handshake.
2. For each issue:
   a. Parse Repo: + Well-known: fields from the body.
   b. Rate-limit: max 3 attempts per repo per 24h. If exceeded → refuse.
   c. Fetch the claimed well-known. If unreachable → refuse.
   d. Validate lineage.parent === ours AND identity.repo === claimed repo.
      Any mismatch → refuse with a specific code.
   e. On success: upsert to memory/adopters-registry.json with status=verified.
      On rejection: upsert with status=rejected + rejectionCode (so rate-
      limiting still works on bad actors).
3. Re-verify every existing non-rejected entry:
   a. Fetch their well-known + dashboard.
   b. Compute the 3-criteria status.
   c. Update lastVerifiedAt + adopted boolean.
4. Write memory/adopters-registry.json + public/adopters.json.
```

## 5. Refusal codes

Every refusal lands in the public refusal log via the existing `S-017` surface:

| Code | Meaning |
|---|---|
| `handshake_body_unparseable` | Issue body lacks Repo: or Well-known: lines |
| `handshake_well_known_unreachable` | Fetch timed out or returned non-2xx |
| `handshake_well_known_schema_invalid` | Schema field is not `orbit-well-known/1` |
| `handshake_lineage_missing` | No `lineage` object in well-known |
| `handshake_lineage_mismatch` | `lineage.parent` points elsewhere |
| `handshake_identity_mismatch` | `identity.repo` doesn't match the claimed repo |
| `handshake_rate_limited` | >3 attempts from this repo in 24h |

## 6. Rate limit and spam defense

- **Max 3 attempts per claimed repo per 24h** — tracked via `handshakeAttemptedAt` in the registry, including rejected attempts.
- **Lineage backlink required** — anyone can open an issue, but only adopters whose public well-known points back can be verified. Drive-by spam fails check (d).
- **Stale auto-close (7 days)** — unverified entries that never resolve are auto-cleared. *(Spec; not yet implemented — TBD in S-ADP-2.)*

## 7. Privacy

- Adopters opt in via `memory/orbit-lineage.json.handshakeOptedIn` (default `false`).
- The scaffolder's `--handshake` flag flips this to `true` at scaffold time.
- Removing the lineage object from the well-known is the off-switch — next mothership cycle will refuse the entry on re-verification.
- No data is collected beyond what the adopter publishes publicly. No telemetry.

## 8. Public surface

- `public/adopters.json` — written every cycle. Schema `orbit-adopters/1`. Contains `total`, `adopted`, `phase1Target`, `phase5Target`, `phase1Progress`, `phase5Progress`, `list`.
- Dashboard SPA — "adopters" cell shows `X / 5` ratio against the Phase 1 target.
- SDK `projectForDashboard()` — exposes the same slice under `adopters`.
- MCP server — read-only access via `getDashboardProjection` (already wired).

## 9. CLI surface

```
npm run orbit:adopter -- add --repo owner/name --well-known URL [--public-url URL] [--note "..."]
npm run orbit:adopter -- list [--json]
npm run orbit:adopter -- verify
npm run orbit:adopter -- remove --repo owner/name
```

`add` is used to seed adopters who haven't (or can't) run the handshake workflow. `verify` re-runs the 3-criteria check immediately without waiting for the next cycle.

## 10. Cross-references

- D-008 — public cast pattern. New-adopter casts go through the standard farcaster pipeline (deferred until signer provisioned).
- S-016 — adopter onboarding push. Templates in `PLAN/OUTREACH_TEMPLATE.md` use this protocol's lineage backlink as the "adopted" definition.
- `PLAN/ADOPTERS.md` — narrative per-adopter documentation; the table is now generated from `memory/adopters-registry.json`.
- `PLAN/SPECS/FEDERATION.md` — same well-known transport; future `INTEL_SHARE` discovery (Phase 4) will use the lineage field for automatic peer discovery.

End of spec.
