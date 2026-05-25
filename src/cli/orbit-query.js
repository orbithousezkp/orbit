#!/usr/bin/env node
"use strict";

// orbit query <repo-url-or-domain>
//
// Fetches /.well-known/orbit.json from another orbit deployment and validates
// it against the federation schema. Prints a slim summary; full payload with
// --json. Federation read primitive (Day-1 launch).

const { validateWellKnown, WELL_KNOWN_SCHEMA } = require("../agent/well-known");

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
  console.error("usage: orbit query <repo-url-or-domain> [--json]");
  console.error("  example: orbit query orbit.horse");
  console.error("  example: orbit query https://example.com");
  process.exit(2);
}

function buildUrl(input) {
  const trimmed = input.replace(/\/$/, "");
  if (/^https?:\/\//.test(trimmed)) {
    return `${trimmed}/.well-known/orbit.json`;
  }
  return `https://${trimmed}/.well-known/orbit.json`;
}

async function main() {
  const url = buildUrl(target);
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    console.error(`fetch failed: ${error.message}`);
    process.exit(1);
  }

  if (!response.ok) {
    console.error(`${url} returned HTTP ${response.status}`);
    process.exit(1);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    console.error(`response is not valid JSON: ${error.message}`);
    process.exit(1);
  }

  const validation = validateWellKnown(data);
  if (jsonOnly) {
    console.log(JSON.stringify({ url, ok: validation.ok, errors: validation.errors, data }, null, 2));
    process.exit(validation.ok ? 0 : 1);
  }

  console.log(`# Orbit Query — ${url}`);
  console.log("");
  if (!validation.ok) {
    console.log(`Schema check: FAIL`);
    for (const err of validation.errors) {
      console.log(`  - ${err}`);
    }
    console.log("");
    console.log("(continuing with partial output)");
    console.log("");
  } else {
    console.log(`Schema check: OK (${WELL_KNOWN_SCHEMA})`);
    console.log("");
  }

  console.log(`Product : ${data.product && data.product.name || "(unknown)"}`);
  console.log(`Category: ${data.product && data.product.category || "(unset)"}`);
  console.log(`Phase   : ${data.activePhase ? `${data.activePhase.id} ${data.activePhase.name} [${data.activePhase.status}]` : "(unset)"}`);
  if (data.identity) {
    console.log(`Repo    : ${data.identity.repo || "(unset)"}`);
    console.log(`Signer  : ${data.identity.signer || "(unset)"}`);
  }
  if (data.walletPolicy) {
    console.log(`Wallet  : ${data.walletPolicy.approvalMode || "(unset)"}`);
    const token = data.walletPolicy.token || {};
    console.log(`Token   : ${token.symbol || "(none)"} (${token.launchStatus || "?"})`);
  }
  if (Array.isArray(data.capabilities)) {
    console.log("");
    console.log(`Capabilities (${data.capabilities.length} active):`);
    for (const cap of data.capabilities.slice(0, 12)) {
      console.log(`  - ${cap.id || "?"}: ${cap.name || "(unnamed)"}`);
    }
    if (data.capabilities.length > 12) {
      console.log(`  ... +${data.capabilities.length - 12} more`);
    }
  }

  process.exit(validation.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(`unexpected error: ${error && error.message ? error.message : error}`);
  process.exit(1);
});
