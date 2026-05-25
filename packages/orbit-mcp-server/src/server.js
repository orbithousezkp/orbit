"use strict";

// JSON-RPC 2.0 over stdio MCP server. Newline-delimited messages.
// Implements the minimum surface needed by Claude Desktop and other MCP
// clients: initialize, initialized notification, tools/list, tools/call,
// resources/list, resources/read.
//
// Zero external deps. The `@modelcontextprotocol/sdk` is intentionally NOT
// pulled in — Orbit's whole point is auditability without supply chain risk.

const readline = require("readline");
const { adapt } = require("./sdk-adapter");
const { defineTools, listToolsManifest, callTool } = require("./tools");
const { listResources, readResource } = require("./resources");

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "@orbit-house/mcp-server",
  version: "0.1.0"
};

function jsonRpcResponse(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  return JSON.stringify({ jsonrpc: "2.0", id, error: err });
}

function send(line) {
  process.stdout.write(`${line}\n`);
}

function handleMessage(msg, ctx) {
  if (msg.method === "initialize") {
    return jsonRpcResponse(msg.id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false }
      },
      serverInfo: SERVER_INFO
    });
  }

  if (msg.method === "initialized" || msg.method === "notifications/initialized") {
    // Notification — no response.
    return null;
  }

  if (msg.method === "tools/list") {
    return jsonRpcResponse(msg.id, { tools: listToolsManifest(ctx.tools) });
  }

  if (msg.method === "tools/call") {
    const params = msg.params || {};
    const result = callTool(ctx.tools, params.name, params.arguments || {});
    return jsonRpcResponse(msg.id, result);
  }

  if (msg.method === "resources/list") {
    return jsonRpcResponse(msg.id, { resources: listResources(ctx.adapter) });
  }

  if (msg.method === "resources/read") {
    const params = msg.params || {};
    const data = readResource(ctx.adapter, params.uri);
    return jsonRpcResponse(msg.id, {
      contents: [
        {
          uri: params.uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2)
        }
      ]
    });
  }

  if (msg.method === "ping") {
    return jsonRpcResponse(msg.id, {});
  }

  return jsonRpcError(msg.id, -32601, `method not found: ${msg.method}`);
}

async function runStdioServer({ repoRoot } = {}) {
  const adapter = adapt(repoRoot || process.cwd());
  const tools = defineTools(adapter);
  const ctx = { adapter, tools };

  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  rl.on("line", (raw) => {
    const line = String(raw || "").trim();
    if (!line) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      send(jsonRpcError(null, -32700, `parse error: ${err.message}`));
      return;
    }
    if (msg.jsonrpc !== "2.0") {
      send(jsonRpcError(msg.id ?? null, -32600, "invalid request: jsonrpc must be 2.0"));
      return;
    }
    let response;
    try {
      response = handleMessage(msg, ctx);
    } catch (err) {
      response = jsonRpcError(msg.id ?? null, -32603, `internal error: ${err.message}`);
    }
    if (response !== null) send(response);
  });

  rl.on("close", () => process.exit(0));

  return new Promise(() => {});
}

module.exports = {
  runStdioServer,
  handleMessage,
  PROTOCOL_VERSION,
  SERVER_INFO
};
