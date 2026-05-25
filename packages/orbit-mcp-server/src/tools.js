"use strict";

// Tool definitions + handlers for the Orbit MCP server. All tools are
// read-only — D-014 forbids any on-chain action without an approval issue,
// and the MCP surface does not expose a write path.

function defineTools(adapter) {
  return [
    {
      name: "getCycles",
      description: "List recent cycle entries from memory/cycles.jsonl. Returns newest-first.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100, default: 25 }
        }
      },
      handler: (args) => adapter.getCycles(args || {})
    },
    {
      name: "getReceipt",
      description: "Read a signed cycle receipt by cycle number. Returns the projected receipt (path, signer, signatureHash, steps).",
      inputSchema: {
        type: "object",
        required: ["cycle"],
        properties: {
          cycle: { type: "integer", minimum: 1 }
        }
      },
      handler: (args) => adapter.getReceipt(args || {})
    },
    {
      name: "getRefusals",
      description: "List recent refusals captured in cycle receipts. Each entry has cycle, tool, reason, severity, category.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 50, default: 20 }
        }
      },
      handler: (args) => adapter.getRefusals(args || {})
    },
    {
      name: "getTreasury",
      description: "Return the treasury snapshot: token state, fees, distribution policy, budgets.",
      inputSchema: { type: "object" },
      handler: () => adapter.getTreasury()
    },
    {
      name: "getDashboardProjection",
      description: "Return the slim dashboard projection — same shape as public/dashboard.json. Includes lifecycle, walletPolicy, permissions, receipts, refusals, missions.",
      inputSchema: { type: "object" },
      handler: () => adapter.getDashboardProjection()
    },
    {
      name: "getFederationPeers",
      description: "List peers from the federation registry (memory/federation.json or memory/peers.json). Returns [] if no registry exists.",
      inputSchema: { type: "object" },
      handler: () => adapter.getFederationPeers()
    }
  ];
}

function listToolsManifest(tools) {
  return tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema: inputSchema || { type: "object" }
  }));
}

function callTool(tools, name, args) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { isError: true, content: [{ type: "text", text: `unknown tool: ${name}` }] };
  }
  try {
    const result = tool.handler(args);
    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) }
      ]
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `tool ${name} failed: ${err.message}` }]
    };
  }
}

module.exports = { defineTools, listToolsManifest, callTool };
