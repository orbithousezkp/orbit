"use strict";

/**
 * @orbit-house/tool-example — reference plugin scaffold for the Orbit
 * plugin/tool loader (S-024).
 *
 * Exposes a single read-only `echo` tool used as the smoke test for
 * capability-allowlist enforcement and response sanitization. The plugin
 * declares only the `read-memory` capability — it does NOT touch the
 * network, wallet, or any write path.
 *
 * Plugin shape conforms to `src/agent/plugin-loader.js`:
 *   { name, version, capabilities, tools: [{ name, description, inputSchema, handler }] }
 */

const NAME = "@orbit-house/tool-example";
const VERSION = "0.1.0";

const tools = [
  {
    name: "echo",
    description:
      "Echoes a short message back to the caller. Read-only; no I/O. Useful as a smoke test for verifying that the plugin loader is wired correctly without exercising any side-effectful capability.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Message to echo. Truncated to 200 characters before return."
        }
      },
      required: ["message"],
      additionalProperties: false
    },
    handler: async (input = {}) => {
      const message = input && typeof input.message === "string" ? input.message : "";
      // Deliberately never return `text` / `rendered` / raw HTML — the
      // plugin loader's sanitizeToolResponse would strip them anyway, but
      // example code should model the right shape.
      return {
        status: "ok",
        echoed: String(message).slice(0, 200),
        length: message.length
      };
    }
  }
];

module.exports = {
  name: NAME,
  version: VERSION,
  capabilities: ["read-memory"],
  tools
};
