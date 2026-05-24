#!/usr/bin/env node
"use strict";

const { loadConfig } = require("../agent/config");
const { infrastructureStatus } = require("../agent/infrastructure");

function main() {
  const config = loadConfig();
  const status = infrastructureStatus(config.repoRoot);
  const summary = status.summary;

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(`${summary.productName}: ${summary.category}`);
  console.log(`Problem: ${summary.problem}`);
  console.log(`Active phase: ${summary.activePhase ? summary.activePhase.name : "none"}`);
  if (summary.activePhase && summary.activePhase.goal) {
    console.log(`Phase goal: ${summary.activePhase.goal}`);
  }
  console.log(`Layers: ${summary.layers.length}`);
  console.log(`Surfaces: ${summary.totalSurfaces} (${summary.surfaceCounts.active} active)`);
  console.log(`Capabilities: ${summary.totalCapabilities} (${summary.activeCapabilities} active, ${summary.plannedCapabilities} planned)`);
  console.log(`Commands: ${summary.totalCommands} (${summary.commandCounts.planned} planned)`);
  console.log(`Access surfaces: ${summary.totalAccess} (${summary.accessCounts.active} active, ${summary.accessCounts.planned} planned)`);
  console.log(`Wallet policy: ${summary.walletMode || "not configured"}`);
  if (summary.walletBlockedLiveActions.length) {
    console.log(`Blocked live wallet actions: ${summary.walletBlockedLiveActions.join(", ")}`);
  }
  console.log(`Receipt root: ${summary.receiptRoot || "not configured"}`);

  if (summary.layers.length) {
    console.log("");
    console.log("Layers:");
    for (const layer of summary.layers) {
      console.log(`- ${layer.name || layer.id} (${layer.status || "planned"})`);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
