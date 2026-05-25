"use strict";

// Resource definitions for the Orbit MCP server. Resources are addressable
// read-only artifacts that MCP clients can request by URI.
//
// Schemes:
//   cycle://N          → metadata for cycle N from memory/cycles.jsonl
//   receipt://N        → signed receipt for cycle N
//   dashboard://current → the projected dashboard snapshot

const STATIC_RESOURCES = [
  {
    uri: "dashboard://current",
    name: "Current dashboard projection",
    description: "Slim dashboard JSON — lifecycle, walletPolicy, receipts, refusals, missions.",
    mimeType: "application/json"
  }
];

function listResources(adapter) {
  const cycles = adapter.getCycles({ limit: 5 });
  const dynamic = [];
  for (const c of cycles) {
    if (Number.isFinite(c.cycle)) {
      dynamic.push({
        uri: `cycle://${c.cycle}`,
        name: `cycle ${c.cycle}`,
        description: `Cycle ${c.cycle} metadata (${c.status || "completed"}).`,
        mimeType: "application/json"
      });
      dynamic.push({
        uri: `receipt://${c.cycle}`,
        name: `receipt for cycle ${c.cycle}`,
        description: `Signed receipt for cycle ${c.cycle}.`,
        mimeType: "application/json"
      });
    }
  }
  return [...STATIC_RESOURCES, ...dynamic];
}

function readResource(adapter, uri) {
  const u = String(uri || "");
  const cycleMatch = u.match(/^cycle:\/\/(\d+)$/);
  if (cycleMatch) {
    const n = Number(cycleMatch[1]);
    const cycles = adapter.getCycles({ limit: 100 });
    const match = cycles.find((c) => Number(c.cycle) === n);
    if (!match) return { error: `cycle ${n} not found` };
    return match;
  }
  const receiptMatch = u.match(/^receipt:\/\/(\d+)$/);
  if (receiptMatch) {
    return adapter.getReceipt({ cycle: Number(receiptMatch[1]) });
  }
  if (u === "dashboard://current") {
    return adapter.getDashboardProjection();
  }
  return { error: `unsupported resource uri: ${u}` };
}

module.exports = { listResources, readResource };
