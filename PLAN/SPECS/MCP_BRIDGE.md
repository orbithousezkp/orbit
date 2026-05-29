# MCP_BRIDGE.md — MCP/HTTP Bridge for SDK (S-031)

## 1. Goal

Expose the Orbit SDK as MCP (Model Context Protocol) tools so any MCP-capable assistant — Claude Desktop, IDE extensions, other agents — can read Orbit state. Read-only at launch; write/admin endpoints are Phase 5 work and stay behind authentication.

## 2. Constraints

- github-only distribution — package published as `@orbithouse/mcp-server` on npm; no hosted server obligation
- No on-chain action via MCP — read-only only per **D-014**
- Token-launch hard-block per **D-018** — read-only MCP can ship pre-launch, but token-utility surfaces wait for S-GATE-2
- Public data is unauthenticated (matches the existing dashboard); write/admin requires token gating

## 3. Scope

In:
- stdio MCP server (canonical transport; Claude Desktop default)
- Optional HTTP MCP for hosted/inspector use (`@modelcontextprotocol/sdk` HTTP transport)
- Tool set (read-only): `getCycles`, `getReceipts`, `getRefusals`, `getTreasury`, `getDashboardProjection`, `getFederationPeers`
- Resource set: `cycle://N`, `receipt://N`, `dashboard://current`

Out:
- Write tools (e.g., open issue, propose buyback) — Phase 5 with auth
- Real-time subscriptions (MCP doesn't standardize this yet)
- Multi-tenant hosted MCP — every adopter runs their own instance

## 4. Design

### Package layout (`packages/orbit-mcp-server/`)
```
package.json         (name: @orbithouse/mcp-server, bin: orbit-mcp)
bin.js               (#!/usr/bin/env node)
src/index.js         (MCP server bootstrap)
src/tools.js         (tool definitions)
src/resources.js     (resource definitions)
src/sdk-adapter.js   (thin wrapper around @orbithouse/sdk)
README.md
LICENSE
```

### Tool surface (initial)
```js
const TOOLS = [
  { name: "getCycles",      description: "List recent cycles", inputSchema: { type:"object", properties:{ limit:{type:"integer", min:1, max:100} } } },
  { name: "getReceipt",     description: "Read a signed cycle receipt by number", inputSchema: { type:"object", properties:{ cycle:{type:"integer"} }, required:["cycle"] } },
  { name: "getRefusals",    description: "List recent refusals", inputSchema: { type:"object", properties:{ limit:{type:"integer", min:1, max:50} } } },
  { name: "getTreasury",    description: "Treasury snapshot", inputSchema: { type:"object" } },
  { name: "getDashboardProjection", description: "The slim dashboard JSON projection", inputSchema: { type:"object" } },
  { name: "getFederationPeers", description: "Peers from the federation registry", inputSchema: { type:"object" } }
];
```

### Resource surface
- `cycle://{n}` — full proof JSON for cycle N (signed)
- `receipt://{n}` — alias for cycle (mirrors SDK terminology)
- `dashboard://current` — current dashboard projection
- `lore://genesis` — lore/00-genesis.md content

### Auth model
- Read tools: unauthenticated
- Write tools (Phase 5): bearer token, validated against `ORBIT_MCP_AUTH_TOKEN` env var
- Token-gated tools: signed claim from SUBSCRIPTION_TIER.md included in tool args

## 5. D-014 + D-018 Alignment

| Decision | Application |
|---|---|
| D-014 | MCP never exposes a write or on-chain tool without explicit per-action approval flow. Initial release ships read-only. |
| D-018 | Read-only MCP can ship pre-launch (it's a window into existing public data). Token-utility methods (premium SDK surfaces) inactive until S-GATE-2. |

## 6. Failure Modes

1. SDK throws on missing repoRoot → MCP returns `{isError: true, content: [{type:"text", text:"orbit_repo_not_found"}]}`, no crash.
2. Stale dashboard.json → tool surface shows `stale: true` flag with `lastUpdated`; MCP doesn't refetch.
3. Token-gated tool called by non-subscriber → MCP returns `{isError: true, ..., text:"tier_required"}` (Phase 5 surface).
4. Resource URI with bad cycle number → 404-equivalent MCP error response.
5. HTTP transport bound to non-localhost without auth → server refuses to start; warns about authless exposure.

## 7. Test Plan (future)

- Tool listing matches declared TOOLS array
- `getCycles` returns expected shape
- `getReceipt` round-trips a known receipt
- Bad input rejected per inputSchema validation
- HTTP transport requires either localhost OR auth token
- Tool errors don't crash the MCP server process
- Resource URIs return correct content type
- Compatibility test: spawn server as child process, connect with MCP client SDK, list tools, call one, assert response

## 8. Open Questions

- Should we ship a Claude Desktop config snippet in the README? Yes — adoption lubricant.
- Tool naming convention: snake_case (Anthropic style) vs camelCase (existing SDK)? Match SDK (camelCase) for consistency.
- HTTP transport: ship in v1 or wait? Ship gated behind localhost-only by default; expose-to-internet requires explicit env flag.
- Should the MCP server hot-reload on cycle write? Yes — file watch on `runtime/proofs/`.

## 9. Cross-References

- `packages/orbit-sdk/` — wrapped surface
- `PLAN/SPECS/SUBSCRIPTION_TIER.md` — auth model for premium tools
- `PLAN/DECISIONS.md` — D-014, D-018
