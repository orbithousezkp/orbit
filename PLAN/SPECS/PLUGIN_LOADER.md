# PLUGIN_LOADER — Plugin / Tool Loader (S-024)

> Spec for S-024. Bound by [D-014](../DECISIONS.md) (no on-chain action
> without approval) and [D-018](../DECISIONS.md) (token-launch hard-block).
> Companion implementation lives at `src/agent/plugin-loader.js`. Reference
> scaffold lives at `packages/orbit-tool-example/`.

## 1. Goal

Let third parties ship tools that an Orbit instance can invoke inside its
cycle loop, without compromising the safety envelope that makes Orbit
trustworthy. A plugin is just an npm package whose `package.json` declares
`"orbit": { "plugin": true }` and whose default export matches a fixed
shape: `{ name, version, capabilities, tools }`. The cycle's tool registry
gains every tool from every loaded plugin, exactly as if the tool had
shipped in `src/agent/tools.js` — except every capability the plugin uses
is whitelisted at load time and gated at call time.

This is the on-ramp for the broader plugin marketplace
([PLUGIN_MARKETPLACE.md](PLUGIN_MARKETPLACE.md), S-033) and the prerequisite
for the bounty market accepting plugin work
([BOUNTY_MARKET.md](BOUNTY_MARKET.md), S-019/S-020).

## 2. Constraints

- **GitHub-only.** Plugins are installed via `npm install` and shipped in
  the adopter repo's `node_modules`. No central plugin server, no remote
  fetch at runtime.
- **No new runtime dependency in Orbit core.** The loader uses only
  `node:fs`, `node:path`, and `require.resolve`.
- **No on-chain action without approval (D-014).** Plugins declaring the
  `wallet` capability are forced to DRY_RUN unless the owner explicitly
  flips `ORBIT_PLUGIN_LIVE=true`. Even then, the existing approval-issue
  flow for buyback / merkle-anchor / external-spend stays in effect — a
  plugin cannot bypass `guardSpend`.
- **D-018 stays intact.** The pre-launch verification gate is independent
  of the plugin loader. A plugin cannot mint, swap, or transfer the token
  until `state.preLaunchVerified === true`, regardless of capabilities.
- **Anti-exfil.** Tool handlers MUST NEVER surface raw `text` / `rendered`
  / HTML back into a proof. `sanitizeToolResponse` strips them defensively.
- **Owner opt-in per plugin.** Plugins are not auto-loaded from
  `node_modules`. The owner must add an entry to `memory/plugins.json`
  (via approval issue, D-014 pattern) and explicitly enable it.
- **Capability allowlist is frozen.** Adding a new capability requires a
  spec update plus a matching gate in `applyCapabilityGate`. Unknown
  capabilities are rejected at validation time.

## 3. Scope

### In

- Capability allowlist: `read-issues`, `comment-issues`, `read-memory`,
  `write-memory`, `wallet`, `network`.
- Manifest at `memory/plugins.json` listing approved plugins.
- `loadPlugins(repoRoot, options)` — read manifest, resolve modules from
  the adopter repo's `node_modules`, validate, return ready-to-register
  tools.
- `validatePlugin(plugin)` — pure structural validator (no I/O).
- `applyCapabilityGate(plugin, capability)` — runtime gate that resolves
  whether the plugin can use a capability and whether the call must run
  DRY_RUN.
- `sanitizeToolResponse(response)` — strips forbidden fields + HTML before
  the response touches a proof.
- `invokeToolSafely(handler, input, context)` — catches thrown errors,
  converts to `{ isError: true, reason }`.
- Reference scaffold under `packages/orbit-tool-example/` exercising the
  `read-memory` capability via a single `echo` tool.

### Out

- Hot-reload of plugins inside a running cycle. The cycle loop reads the
  manifest at startup; plugin changes take effect on the next cycle.
- Cross-repo plugin sharing. Each adopter installs its own copy via npm.
- Auto-discovery of plugins from `node_modules` without a manifest entry.
- Sandbox isolation (vm contexts, worker threads). Plugins run in the same
  Node process — the trust boundary is the capability gate and the manual
  install + manifest opt-in, not a process boundary.
- Marketplace surfacing / reputation scoring (deferred to S-033,
  [PLUGIN_MARKETPLACE.md](PLUGIN_MARKETPLACE.md)).
- Per-tool rate limits beyond the global cycle budget (deferred).

## 4. Design

### 4.1 Plugin shape

```js
module.exports = {
  name:    "@orbithouse/tool-example",        // npm-style name
  version: "0.1.0",                            // semver
  capabilities: ["read-memory"],               // subset of allowlist
  tools: [
    {
      name:        "echo",                     // snake_case, <=64 chars
      description: "Plain-English description.",
      inputSchema: { type: "object", ... },    // JSON Schema (object only)
      handler:     async (input, context) => ({ status: "ok", ... })
    }
  ]
};
```

`validatePlugin` enforces every field. The first failure throws an Error
with a stable, machine-readable message — surfaceable as a refusal log.

### 4.2 Manifest

`memory/plugins.json`:

```json
{
  "plugins": [
    {
      "name": "@orbithouse/tool-example",
      "source": "@orbithouse/tool-example",
      "version": "0.1.0",
      "capabilities": ["read-memory"],
      "enabled": true,
      "addedAt": "2026-05-24T00:00:00Z",
      "addedBy": "approval-issue#42"
    }
  ]
}
```

- `name` MUST equal the plugin module's `name`. A mismatch is a load-time
  refusal.
- `source` is either a `require()`-resolvable specifier
  (`@orbithouse/tool-example`) or a repo-relative path
  (`./packages/orbit-tool-example`). Both resolve from the adopter
  `repoRoot`.
- `capabilities` is the owner-authorized set. A plugin update that quietly
  expands the capability list (e.g., adds `wallet`) is REFUSED at load
  time.
- `enabled: false` causes the entry to be skipped without error.
- `addedBy` references the approval issue that authorized the install.

Duplicate `name` entries inside the manifest are refused (no silent
shadowing of a trusted entry by a hostile later one).

### 4.3 Capability gate

`applyCapabilityGate(plugin, requestedCapability, env)` resolves to one of:

- `{ ok: false, reason: "capability_unknown", dryRun: true }` — capability
  is not in the frozen allowlist.
- `{ ok: false, reason: "capability_undeclared", dryRun: true }` — plugin
  did not declare this capability in its own export.
- `{ ok: true, dryRun: false }` — capability is read-only or
  side-effect-free, no DRY_RUN needed.
- `{ ok: true, dryRun: true }` — capability is `wallet` or `network` and
  `ORBIT_PLUGIN_LIVE !== "true"`.

The gate is purely advisory inside the plugin loader — the caller (cycle
loop, in S-026 wiring) is responsible for honoring `dryRun`. The wallet
helper that signs and sends transactions retains its own D-014 /
approval-issue gate; the plugin path cannot bypass it.

### 4.4 Network timeout cap

Plugins declaring `network` can request a custom timeout per invocation.
`clampNetworkTimeout(requestedMs)` returns `min(requestedMs,
NETWORK_TIMEOUT_MAX_MS)` (15s today) with a default of 5s. A plugin cannot
disable the timeout — a runaway fetch must not hang the cycle.

### 4.5 Response sanitization

`sanitizeToolResponse(value)` walks the response and:

1. Recursively drops any key in `FORBIDDEN_RESPONSE_FIELDS`
   (`text`, `rendered`, `renderedText`, `rawText`, `html`, `innerHTML`,
   `outerHTML`, `raw`, `prompt`, `systemPrompt`).
2. Replaces HTML markup with stripped strings (`<a href=...>x</a>` → `x`).
3. Coerces unsupported types (functions, symbols, bigints) to `null`.
4. Preserves safe scalars (numbers, booleans) and arrays as-is structurally.

Output is always a fresh object — never a reference to the plugin's
internal state. This is the LAST line of anti-exfil defense, run on every
return value regardless of plugin trust level.

### 4.6 Safe handler invocation

`invokeToolSafely(handler, input, context)`:

- Awaits `handler(input, context)`.
- Catches synchronous throws + promise rejections.
- On failure, returns `{ isError: true, reason: <truncated message> }`.
- On success, runs the value through `sanitizeToolResponse` before return.

The cycle loop should call this rather than the raw handler so a buggy
plugin never crashes the run.

## 5. D-014 + D-018 Alignment

| Decision | Application |
|---|---|
| D-006 | Plugin invocations are recorded in the cycle proof like any other tool call. Inputs/outputs are sanitized via the existing `sanitizeProofInput` / `sanitizeProofOutput` pipeline. |
| D-014 | `wallet` capability defaults to DRY_RUN. Even when `ORBIT_PLUGIN_LIVE=true`, the wallet helper still requires the per-action approval issue (`guardSpend`, `proposeAnchor`, `proposeBuyback`). Plugins cannot bypass the approval flow. |
| D-018 | The pre-launch verification gate is checked by every on-chain code path independently of plugins. A plugin requesting `wallet` while `state.preLaunchVerified !== true` will still be refused at the wallet helper layer. |

## 6. Failure Modes

1. **Manifest missing.** `loadPlugins` returns `{ plugins: [], errors: [] }`.
   The cycle proceeds with built-in tools only.
2. **Manifest unparseable.** Same as missing. The JSON parse error is
   swallowed by `readJson` (matching governance.js / federation.js). A
   future S-025 may surface this as a refusal-log entry.
3. **Plugin not installed.** `resolvePluginModule` returns
   `{ ok: false, reason }`. The plugin is omitted and an `errors[]` entry
   is added; other plugins still load.
4. **Plugin declares an unknown capability.** `validatePlugin` throws;
   the entry is omitted. The owner sees the error in the errors list.
5. **Plugin asks for a capability the manifest did not authorize.**
   Refused at load time with `capabilities_not_authorized: <cap>`.
6. **Plugin reports a different name than the manifest.** Refused with
   `name_mismatch`.
7. **Tool handler throws.** `invokeToolSafely` returns
   `{ isError: true, reason }` — the cycle continues.
8. **Tool handler returns forbidden fields.** `sanitizeToolResponse`
   strips them silently. (No refusal, because the strip itself is the
   enforcement — surfacing it would be redundant noise.)
9. **Two plugins claim the same tool name.** Resolved at the cycle-loop
   layer, not here. The loader returns each plugin namespaced by
   `plugin.name`; the registration step prefixes the tool with the plugin
   name (`@orbithouse/tool-example:echo`) so collisions are impossible by
   construction.
10. **Duplicate manifest entry for the same plugin name.** Second entry
    refused with `duplicate_in_manifest`.

## 7. Test Plan

See `tests/plugin-loader.test.js` (≥15 tests, `node --test`, no network,
no writes outside `os.tmpdir()`):

- `validatePlugin` rejects missing name / version / capabilities / tools.
- `validatePlugin` rejects an unknown capability string.
- `validatePlugin` rejects duplicate tool names within a single plugin.
- `loadPlugins` returns `{ plugins: [], errors: [] }` when the manifest is
  missing.
- `loadPlugins` returns `{ plugins: [], errors: [] }` when no plugins are
  enabled.
- `loadPlugins` honors `ORBIT_ENABLE_PLUGINS=false` (returns immediately).
- `applyCapabilityGate` denies a capability not in the plugin's declared
  set.
- `applyCapabilityGate` allows a capability in the declared set.
- `sanitizeToolResponse` strips `text` and `rendered` fields recursively.
- `sanitizeToolResponse` preserves safe scalars and structured fields.
- `sanitizeToolResponse` strips HTML markup from string values.
- `isPluginEnabled` is false unless `ORBIT_ENABLE_PLUGINS === "true"` (or
  `config.plugins.enabled === true`).
- A plugin with `wallet` capability is forced to DRY_RUN unless
  `ORBIT_PLUGIN_LIVE === "true"`.
- A plugin with `network` capability honors `clampNetworkTimeout`.
- `invokeToolSafely` catches thrown errors and returns
  `{ isError: true, reason }`.
- Duplicate plugin name across manifest entries is rejected.
- Manifest entries with `enabled: false` are skipped without error.
- Plugin reporting a name that doesn't match the manifest is refused.

## 8. Open Questions

- **Per-tool ledger.** Should every plugin tool invocation get its own
  receipt entry in `memory/plugin-receipts.json`, or stay inside the
  existing cycle proof? Deferred to S-025 (refusal logging spec already
  covers refusals; success path may piggy-back).
- **Versioning.** Should the loader enforce that a plugin's runtime
  version matches the manifest version exactly, or accept any compatible
  semver? Today we record the version but do not pin; opening a future
  refinement.
- **Capability scopes.** `read-issues` today is "any issue in this repo"
  — should it scope per label? Deferred until a real plugin needs it.
- **Plugin signing.** Should we require plugins to be signed by a known
  author key? Deferred to PLUGIN_MARKETPLACE.md (S-033) which already
  proposes a registry-level signature.

## 9. Cross-References

- `src/agent/plugin-loader.js` — implementation.
- `tests/plugin-loader.test.js` — tests.
- `packages/orbit-tool-example/` — reference scaffold.
- `PLAN/SPECS/PLUGIN_MARKETPLACE.md` — registry + reputation (S-033).
- `PLAN/SPECS/BOUNTY_MARKET.md` — plugins as bounty deliverables.
- `PLAN/SPECS/FEDERATION.md` — `INTEL_SHARE` `kind: "plugin_alert"` for
  flagged plugins.
- `PLAN/DECISIONS.md` — D-006, D-014, D-018.
