"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const writer = require("../packages/create-orbit-house/src/writer");

const TEMPLATES_DIR = writer.TEMPLATES_DIR;

const VARS = {
  AGENT_NAME: "test-agent",
  OWNER: "test-owner",
  REPO_URL: "https://github.com/test-owner/test-agent",
  APPROVAL_LABEL: "orbit:approval",
  APPROVAL_ACCEPTED_LABEL: "orbit:approved",
  APPROVAL_REJECTED_LABEL: "orbit:rejected",
  NODE_VERSION: "24",
  MOTHERSHIP_REPO: "orbithousezkp/orbit",
  HANDSHAKE_OPT_IN: "false",
  ADOPTED_AT: "2026-05-25T00:00:00.000Z",
  SCAFFOLDER_VERSION: "0.1.0"
};

function listTemplates() {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  }
  walk(TEMPLATES_DIR);
  return out;
}

test("every template file exists and renders without leaving {{KEY}} placeholders for known vars", () => {
  const files = listTemplates();
  assert.ok(files.length >= 10, `expected >=10 templates, found ${files.length}`);
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const rendered = writer.renderTemplate(raw, VARS);
    const unresolved = rendered.match(/\{\{[A-Z0-9_]+\}\}/g);
    if (unresolved) {
      for (const u of unresolved) {
        assert.fail(`template ${path.relative(TEMPLATES_DIR, file)} has unresolved placeholder ${u}`);
      }
    }
  }
});

test("JSON templates parse after rendering", () => {
  const jsonTemplates = [
    "memory/tasks.json.tpl",
    "memory/governance.json.tpl",
    "memory/treasury.json.tpl",
    "memory/state.json.tpl",
    "memory/orbit-lineage.json.tpl",
    "package.json.partial.json"
  ];
  for (const rel of jsonTemplates) {
    const raw = fs.readFileSync(path.join(TEMPLATES_DIR, rel), "utf8");
    const rendered = writer.renderTemplate(raw, VARS);
    JSON.parse(rendered);
  }
});

test("YAML workflow templates contain expected stanzas", () => {
  const yamlTemplates = [
    ".github/workflows/orbit-cycle.yml.tpl",
    ".github/workflows/orbit-event.yml.tpl"
  ];
  for (const rel of yamlTemplates) {
    const raw = fs.readFileSync(path.join(TEMPLATES_DIR, rel), "utf8");
    const rendered = writer.renderTemplate(raw, VARS);
    assert.ok(rendered.includes("runs-on:"), `${rel} missing runs-on`);
    assert.ok(rendered.includes("steps:"), `${rel} missing steps`);
    assert.ok(rendered.includes("node-version: \"24\""), `${rel} did not interpolate node version`);
    assert.ok(rendered.includes("npm run cycle"), `${rel} missing cycle invocation`);
  }
});

test("templates do NOT contain hardcoded secrets, addresses, or keys", () => {
  const files = listTemplates();
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    // Hex address heuristic: 0x followed by 40 hex chars (an Ethereum address).
    assert.equal(
      /0x[a-fA-F0-9]{40}/.test(raw),
      false,
      `${file} contains a hex address`
    );
    // Private key heuristic: 0x followed by 64 hex chars.
    assert.equal(
      /0x[a-fA-F0-9]{64}/.test(raw),
      false,
      `${file} contains a 64-byte hex value`
    );
    // The literal "candyburst" must not appear in any template.
    assert.equal(
      raw.includes("candyburst"),
      false,
      `${file} mentions candyburst`
    );
  }
});

test("identity template includes agent name and repo url placeholders rendered", () => {
  const raw = fs.readFileSync(path.join(TEMPLATES_DIR, "memory/identity.md.tpl"), "utf8");
  const rendered = writer.renderTemplate(raw, VARS);
  assert.ok(rendered.includes("test-agent"));
  assert.ok(rendered.includes("test-owner"));
  assert.ok(rendered.includes("https://github.com/test-owner/test-agent"));
});

test("governance template wires approval labels", () => {
  const raw = fs.readFileSync(path.join(TEMPLATES_DIR, "memory/governance.json.tpl"), "utf8");
  const rendered = writer.renderTemplate(raw, VARS);
  const parsed = JSON.parse(rendered);
  assert.equal(parsed.externalSpend.approvalIssueLabel, "orbit:approval");
  assert.equal(parsed.externalSpend.approvalAcceptedLabel, "orbit:approved");
  assert.equal(parsed.externalSpend.approvalRejectedLabel, "orbit:rejected");
  assert.equal(parsed.ownerUsername, "test-owner");
});

test(".env.example template lists adopter-relevant env var names (no token-launch surface — D-020)", () => {
  const raw = fs.readFileSync(path.join(TEMPLATES_DIR, ".env.example.tpl"), "utf8");
  const required = [
    "ORBIT_AI_PROVIDERS=",
    "ORBIT_AI_PROVIDER_KEYS=",
    "ORBIT_WALLET_PRIVATE_KEY=",
    "ORBIT_OWNER_USERNAME=",
    "ORBIT_FARCASTER_NEYNAR_API_KEY=",
    "ORBIT_PUBLIC_URL="
  ];
  for (const line of required) {
    assert.ok(raw.includes(line), `.env.example missing ${line}`);
  }
  // D-020: token-launch / treasury / operator-revenue env vars MUST
  // NOT appear in the adopter scaffold. Adopters who choose to
  // launch a token do so independently; the scaffold ships no
  // surface for it.
  const forbidden = [
    "ORBIT_TOKEN_ADMIN_ADDRESS",
    "ORBIT_TREASURY_ADDRESS",
    "ORBIT_OPERATOR_REVENUE_ADDRESS",
    "ORBIT_OPERATOR_REVENUE_BPS",
    "ORBIT_BASE_RPC_URL",
    "ORBIT_ENABLE_TOKEN_LAUNCH",
    "ORBIT_ENABLE_REVENUE_CLAIMS"
  ];
  for (const banned of forbidden) {
    assert.equal(
      raw.includes(banned), false,
      `.env.example must not ship token-launch surface "${banned}" (D-020)`
    );
  }
});
