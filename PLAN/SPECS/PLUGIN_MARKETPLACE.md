# PLUGIN_MARKETPLACE.md — Plugin Marketplace + Reputation (S-033)

## 1. Goal

A registry of published `@orbithouse/tool-*` plugins with aggregate usage stats and a simple reputation score. The registry is a static JSON published to `orbit.horse/registry.json`, refreshed weekly by the host Orbit. Adopter repos opt in to having their plugin usage counted.

## 2. Constraints

- github-only — registry is a static file on GitHub Pages, no central API
- No on-chain action without approval per **D-014**
- Token-launch hard-block per **D-018** — marketplace inactive until post-launch (S-GATE-2)
- No personal data — only repo names (public), aggregate counts, and refusal/error rates
- Plugin authors opt in to listing; opt-out at any time

## 3. Scope

In:
- Discovery: weekly npm crawl for `@orbithouse/tool-*` packages with `package.json` marker `"orbit": { "plugin": true }`
- Aggregation: count of installs (derived from cycle proofs across adopter repos that opt-in)
- Reputation score: simple formula based on install count, refusal rate, last-published-at
- Registry JSON published to `orbit.horse/registry.json`
- Plugin detail page on dashboard (Phase 4)

Out:
- Paid promotion / sponsored slots — never
- Auto-installation of plugins by Orbit — D-014 violation
- Centralized hosting of plugin code (plugins stay on npm)
- Plugin removal-by-fiat (only removed if author marks `orbit.plugin = false` or unpublishes from npm)

## 4. Design

### Registry JSON shape (`registry.json`)
```json
{
  "schema": "orbit-registry/1",
  "generatedAt": "2026-12-01T00:00:00Z",
  "generatedBy": "0x...",
  "signature": "0x...",
  "plugins": [
    {
      "name": "@orbithouse/tool-example",
      "version": "0.3.1",
      "description": "...",
      "capabilities": ["read-memory"],
      "publishedAt": "2026-11-15T...",
      "installCount": 42,
      "refusalRate": 0.02,
      "lastUsedAt": "2026-11-30T...",
      "reputationScore": 87
    }
  ]
}
```

### Reputation formula (initial)
```
base       = log2(installCount + 1) * 10        // capped at 60
recency    = max(0, 20 - daysSinceLastPublish/7) // 20 if just published, 0 if 140+ days stale
quality    = max(0, 20 - refusalRate * 200)      // 20 if 0% refusals, 0 if 10%+ refusals
reputation = base + recency + quality
           = 0..100
```

### Opt-in mechanism
Adopter repos add `memory/plugin-telemetry-optin.json`:
```json
{ "shareInstallCount": true, "shareRefusalRate": false }
```
The host Orbit reads this when building aggregate stats.

## 5. D-014 + D-018 Alignment

| Decision | Application |
|---|---|
| D-014 | Registry inclusion is purely informational; Orbit never auto-installs a registry entry. |
| D-018 | Marketplace inactive until post-launch (S-GATE-2). Pre-launch, plugins still work via PLUGIN_LOADER.md, just no aggregate stats. |

## 6. Failure Modes

1. npm crawl fails (network outage) → use cached registry from last successful crawl; mark `stale: true`.
2. Plugin author renames package → old entry marked `deprecated`, new entry created; install count does not transfer.
3. Plugin author injects malicious code → flagged via federation message (FEDERATION.md `INTEL_SHARE` type `plugin_alert`); marketplace marks `flagged: true`.
4. Reputation score gaming (sybil installs) → tied to cycle-proof signatures; sybil repos with no real cycle activity get filtered.
5. Stats divergence between local opt-in and aggregate → next weekly refresh reconciles; never surface divergence to end user.

## 7. Test Plan (future)

- Reputation formula deterministic for fixture inputs
- Edge: 0 installs → reputation = recency + quality
- Edge: 10%+ refusal rate → quality = 0
- Opt-in respected: repo with `shareInstallCount: false` not counted
- Flagged plugins excluded from top-N listings
- Registry signature verifiable
- Stale-cache behavior on crawl failure

## 8. Open Questions

- Should there be a "verified author" badge (e.g., from a holder of ≥X $ORBIT)? Defer to S-034 holder utility.
- How to surface flagged plugins without slandering authors? Quarantine page, not delisting.
- Cross-marketplace presence (a plugin sold on multiple agent ecosystems): single source of truth on the marketplace, link out for context.

## 9. Cross-References

- `PLAN/SPECS/PLUGIN_LOADER.md` (S-024 parent)
- `PLAN/SPECS/FEDERATION.md` (intel-share for malicious-plugin alerts)
- `PLAN/SPECS/HOLDER_UTILITY.md` (verified-author badge link)
- `PLAN/DECISIONS.md` — D-014, D-018
