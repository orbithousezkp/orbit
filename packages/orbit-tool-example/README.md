# @orbit-house/tool-example

_Part of [Orbit](https://github.com/orbithousezkp/orbit) — the control plane for agent memory and infrastructure inside any GitHub repo._

Reference plugin scaffold for the Orbit plugin/tool loader (S-024). Use this
as the starting point for your own `@orbit-house/tool-*` plugin.

## What it does

Exposes a single read-only `echo` tool that returns the input message
(truncated to 200 chars). The plugin declares only the `read-memory`
capability and performs no network, wallet, or write operations. It is the
smoke test for verifying that the plugin loader is wired correctly in an
adopter repo.

## Installation

In an adopter Orbit repo:

```bash
npm install @orbit-house/tool-example
```

Then opt the plugin in by editing `memory/plugins.json`:

```json
{
  "plugins": [
    {
      "name": "@orbit-house/tool-example",
      "source": "@orbit-house/tool-example",
      "version": "0.1.0",
      "capabilities": ["read-memory"],
      "enabled": true,
      "addedAt": "2026-05-24T00:00:00Z",
      "addedBy": "approval-issue#NN"
    }
  ]
}
```

Plugins are NEVER auto-loaded. The manifest entry must be added by an
approval issue (D-014 pattern) and must explicitly list every capability the
plugin is allowed to use. A plugin that requests a capability not authorized
by the manifest is refused at load time.

Finally, set the master switch in the cycle environment:

```
ORBIT_ENABLE_PLUGINS=true
```

Without this, the loader returns zero plugins regardless of manifest
contents.

## Plugin shape

A plugin module must export:

```js
module.exports = {
  name:    "@orbit-house/tool-yours",
  version: "0.1.0",
  capabilities: ["read-memory" /* | "read-issues" | "comment-issues"
                              | "write-memory" | "wallet" | "network" */],
  tools: [
    {
      name: "snake_case_name",
      description: "Plain-English description of what this does.",
      inputSchema: { type: "object", properties: { ... }, required: [ ... ] },
      handler: async (input, context) => ({ status: "ok", ... })
    }
  ]
};
```

## Anti-exfil rule

Tool handlers MUST NEVER return raw `text`, `rendered`, or HTML markup. The
loader's `sanitizeToolResponse` strips these fields automatically before
the response touches a cycle proof, but plugin code should model the right
shape from the start. Return structured fields like `status`, `count`,
`echoed`, etc.

## DRY_RUN defaults

Plugins that declare the `wallet` or `network` capability are forced into
DRY_RUN mode unless `ORBIT_PLUGIN_LIVE=true` is set in the cycle
environment. This is the D-014 guard rail: no on-chain action and no
outbound network call happens through a plugin without an explicit owner
flip.

## References

- Spec: `PLAN/SPECS/PLUGIN_LOADER.md`
- Loader: `src/agent/plugin-loader.js`
- Tests: `tests/plugin-loader.test.js`
- Marketplace (future): `PLAN/SPECS/PLUGIN_MARKETPLACE.md`

## License

MIT
