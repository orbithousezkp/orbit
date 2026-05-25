# @orbit-house/mcp-server

_Part of [Orbit](https://github.com/orbithousezkp/orbit) — the control plane for agent memory and infrastructure inside any GitHub repo._

A zero-dependency MCP (Model Context Protocol) server that exposes Orbit's machine-readable state as read-only tools and resources. Lets Claude Desktop, IDE extensions, and any other MCP-capable client query an Orbit repo without needing to know the file layout.

Read-only by design. The MCP surface does not expose a write path — every on-chain action in Orbit goes through D-014 (public approval issue + signed receipt), and that flow is incompatible with synchronous tool-call semantics.

---

## Install

```bash
npm install -g @orbit-house/mcp-server
```

Or use `npx` per invocation:

```bash
npx -y @orbit-house/mcp-server
```

The package depends on `@orbit-house/sdk` and ships zero other dependencies.

---

## Run against a repo

```bash
ORBIT_REPO_ROOT=/path/to/orbit-repo orbit-mcp
```

If `ORBIT_REPO_ROOT` is unset, the server uses `process.cwd()`.

---

## Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "orbit": {
      "command": "npx",
      "args": ["-y", "@orbit-house/mcp-server"],
      "env": {
        "ORBIT_REPO_ROOT": "/absolute/path/to/your/orbit-repo"
      }
    }
  }
}
```

Restart Claude Desktop. The Orbit tools and resources will appear in the tools menu.

---

## Tool surface

| Tool | Input | What it does |
|---|---|---|
| `getCycles` | `{ limit?: 1-100, default 25 }` | List recent cycle entries (newest first). |
| `getReceipt` | `{ cycle: integer }` | Read the signed receipt for a specific cycle. |
| `getRefusals` | `{ limit?: 1-50, default 20 }` | List recent refusals across all receipts. |
| `getTreasury` | `{}` | Treasury snapshot (token, fees, distribution policy, budgets). |
| `getDashboardProjection` | `{}` | The slim dashboard JSON — same shape as `public/dashboard.json`. |
| `getFederationPeers` | `{}` | Federation registry peers (returns `[]` if none registered). |

Every tool returns JSON-serialised text in `content[0].text`. Errors are returned as `isError: true` with the message in `content[0].text`.

---

## Resource surface

| URI | Returns |
|---|---|
| `dashboard://current` | The projected dashboard JSON. |
| `cycle://N` | Metadata for cycle N from `memory/cycles.jsonl`. |
| `receipt://N` | Signed receipt for cycle N. |

`resources/list` returns the current dashboard plus dynamic entries for the most recent 5 cycles. Older cycles are reachable via `cycle://N` directly.

---

## Protocol

- MCP protocol version `2024-11-05`
- JSON-RPC 2.0 over stdio, newline-delimited
- Methods implemented: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `ping`

The server does not implement subscriptions, prompts, sampling, or roots — those are out of scope for a read-only Orbit MCP. Phase 5 may add write-side tools behind authentication; until then, this server is a strict subset.

---

## Why no external SDK

`@modelcontextprotocol/sdk` would shorten this implementation by ~200 lines, but Orbit's whole pitch is "audit the whole repo, no supply-chain surprises." A 250-line vendored MCP server keeps that promise — the protocol surface is small enough to implement directly.

If the MCP spec evolves significantly, swap the implementation; the SDK adapter (`src/sdk-adapter.js`) is the stable interface.

---

## Verify locally

```bash
# In an Orbit repo:
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | npx @orbit-house/mcp-server
# Should print a JSON-RPC response with serverInfo and protocolVersion.

echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | npx @orbit-house/mcp-server
# Should list the 6 tools.
```

---

## Cross-references

- Spec: [`PLAN/SPECS/MCP_BRIDGE.md`](../../PLAN/SPECS/MCP_BRIDGE.md) (S-031)
- Session: S-032 build
- SDK: [`@orbit-house/sdk`](../orbit-sdk/) — the read primitive this wraps
- Verifier: [`@orbit-house/verifier`](../orbit-verifier/) — verify the signed proofs this server surfaces

MIT.
