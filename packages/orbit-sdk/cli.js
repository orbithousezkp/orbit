#!/usr/bin/env node
"use strict";

const { createOrbitClient } = require("./index");

function printHelp() {
  console.log([
    "Orbit SDK CLI",
    "",
    "USAGE",
    "  orbit-sdk <command> [--repo <path>] [--json]",
    "",
    "COMMANDS",
    "  status        Show product and lifecycle status",
    "  passport      Show agent passport",
    "  infrastructure Show infrastructure layers and access surfaces",
    "  capabilities  Show capability and surface summary",
    "  permissions   Show approval and blocked-action policy",
    "  wallet        Show read-only wallet policy",
    "  lifecycle     Show wake/sleep lifecycle state",
    "  receipts      Show latest proof receipts",
    "  memory        Show task and knowledge summary",
    "  adoption      Show install/adoption checklist",
    "  bundle        Export the full read-only SDK bundle"
  ].join("\n"));
}

function parseArgs(argv) {
  const args = { command: "", repo: process.cwd(), json: false, help: false };
  const rest = argv.slice(2);
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--repo") {
      index += 1;
      if (!rest[index]) throw new Error("--repo requires a path");
      args.repo = rest[index];
    } else if (!args.command) {
      args.command = arg;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function printObject(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printSummary(command, value) {
  if (command === "status") {
    console.log(`${value.product.name || "Orbit"}: ${value.product.category || "agent infrastructure"}`);
    console.log(`Phase: ${value.activePhase ? value.activePhase.name : "none"}`);
    console.log(`Cycle: ${value.lifecycle.cycle} (${value.lifecycle.lastStatus})`);
    console.log(`Capabilities: ${value.capabilitySummary.activeCapabilities}/${value.capabilitySummary.totalCapabilities} active`);
    console.log(`Latest receipt: ${value.latestReceipt ? value.latestReceipt.path : "none"}`);
    return;
  }

  if (command === "adoption") {
    console.log(`Adoption: ${value.summary.passed}/${value.summary.total} checks passed`);
    for (const check of value.checks) {
      console.log(`${check.ok ? "OK" : "MISS"} ${check.id} - ${check.path}`);
    }
    return;
  }

  if (command === "infrastructure") {
    console.log(`${value.product.name || "Orbit"}: ${value.product.category || "agent infrastructure"}`);
    console.log(`Phase: ${value.activePhase ? value.activePhase.name : "none"}`);
    console.log(`Layers: ${value.summary.totalLayers}`);
    console.log(`Access: ${value.summary.totalAccess}`);
    console.log(`SDK: ${value.summary.sdkStatus || "not declared"}`);
    console.log(`Receipt root: ${value.summary.receiptRoot || "none"}`);
    return;
  }

  if (command === "wallet") {
    console.log(`Approval mode: ${value.approvalMode}`);
    console.log(`Public view only: ${value.publicViewOnly ? "yes" : "no"}`);
    console.log(`No private keys: ${value.noPrivateKeys ? "yes" : "no"}`);
    console.log(`Revenue cadence: ${value.revenue.cadence}`);
    console.log(`Token: ${value.token.configured ? `${value.token.name} (${value.token.symbol})` : "not configured"}`);
    console.log(`Blocked live actions: ${value.blockedLiveActions.join(", ") || "none declared"}`);
    return;
  }

  printObject(value);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.command) {
    printHelp();
    return;
  }

  const client = createOrbitClient({ repoRoot: args.repo });
  const readers = {
    status: client.readStatus,
    passport: client.readPassport,
    infrastructure: client.readInfrastructure,
    capabilities: client.readCapabilities,
    permissions: client.readPermissions,
    wallet: client.readWalletPolicy,
    lifecycle: client.readLifecycle,
    receipts: client.readReceipts,
    memory: client.readMemorySummary,
    adoption: client.adoptionChecklist,
    bundle: client.exportBundle
  };
  const reader = readers[args.command];
  if (!reader) throw new Error(`unknown command: ${args.command}`);

  const value = reader();
  if (args.json) {
    printObject(value);
    return;
  }
  printSummary(args.command, value);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`orbit-sdk: ${error.message}`);
    process.exit(2);
  }
}

module.exports = { main, parseArgs };
