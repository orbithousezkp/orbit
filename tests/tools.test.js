"use strict";

// tools.js is the schema source of truth fed to the LLM. The schemas
// drive what the model can call — drift between this file and the
// dispatch table in actions.js would let the model invent tool calls
// that aren't safely handled, or refuse calls that exist. These tests
// pin both the schema shape and the dispatch parity.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { TOOLS } = require("../src/agent/tools");

test("TOOLS array is non-empty", () => {
  assert.ok(Array.isArray(TOOLS) && TOOLS.length > 0);
});

test("every tool has unique name, non-empty description, and strict JSON-schema input", () => {
  const seen = new Set();
  for (const tool of TOOLS) {
    assert.ok(typeof tool.name === "string" && tool.name.length > 0, `tool has no name`);
    assert.equal(seen.has(tool.name), false, `duplicate tool name: ${tool.name}`);
    seen.add(tool.name);

    assert.ok(typeof tool.description === "string" && tool.description.length > 0,
      `${tool.name} missing description`);

    assert.ok(tool.inputSchema && typeof tool.inputSchema === "object",
      `${tool.name} missing inputSchema`);
    assert.equal(tool.inputSchema.type, "object",
      `${tool.name} inputSchema.type must be "object"`);
    // additionalProperties:false is the safety property — without it, the
    // LLM could smuggle params past actions.js validation.
    assert.equal(tool.inputSchema.additionalProperties, false,
      `${tool.name} must set additionalProperties:false`);
  }
});

test("every tool advertised in tools.js has a dispatch case in actions.js", () => {
  // Drift detector: if a tool exists here but the switch in
  // actions.executeTool doesn't handle it, the LLM can call it and get
  // either a wrong response or a thrown error. Either way, broken.
  const actionsSrc = fs.readFileSync(
    path.join(__dirname, "..", "src", "agent", "actions.js"),
    "utf-8"
  );
  // Look for either case "name": or case 'name': (don't be picky on quotes).
  for (const tool of TOOLS) {
    const pattern = new RegExp(`case ["']${tool.name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["']`);
    assert.ok(
      pattern.test(actionsSrc),
      `tool "${tool.name}" advertised but no dispatch case in actions.js`
    );
  }
});

test("schemas with declared 'required' arrays only reference real properties", () => {
  // Internal consistency: required: ["foo"] without properties.foo is a bug.
  for (const tool of TOOLS) {
    const schema = tool.inputSchema;
    if (!Array.isArray(schema.required)) continue;
    for (const req of schema.required) {
      assert.ok(
        schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, req),
        `${tool.name}: required field "${req}" is not in properties`
      );
    }
  }
});
