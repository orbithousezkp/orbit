"use strict";

// Thin adapter around @orbit-house/sdk so the MCP tool layer doesn't reach
// into SDK internals. Each function returns a plain object (or array) suitable
// for serialising to MCP `content[].text`.

let sdkModule;
try {
  // Published package (production / npm-installed consumer).
  sdkModule = require("@orbit-house/sdk");
} catch {
  // Workspace fallback (this monorepo).
  sdkModule = require("../../orbit-sdk");
}

function adapt(repoRoot) {
  const client = sdkModule.create(repoRoot);

  return {
    getCycles({ limit = 25 } = {}) {
      const all = client.getCycles() || [];
      const capped = Math.min(Math.max(1, Number(limit) || 25), 100);
      return all.slice(-capped).reverse();
    },

    getReceipt({ cycle } = {}) {
      if (!Number.isFinite(Number(cycle))) {
        return { error: "cycle parameter must be a number" };
      }
      const bundle = sdkModule.exportBundle(repoRoot, undefined, { receiptLimit: 100 });
      const receipts = (bundle && bundle.receipts && Array.isArray(bundle.receipts.list))
        ? bundle.receipts.list
        : [];
      const match = receipts.find((r) => Number(r.cycle) === Number(cycle));
      if (!match) return { error: `no receipt found for cycle ${cycle}` };
      return match;
    },

    getRefusals({ limit = 20 } = {}) {
      const slim = sdkModule.projectForDashboard(
        sdkModule.exportBundle(repoRoot, undefined, { receiptLimit: 25 })
      );
      const refusals = Array.isArray(slim.refusals) ? slim.refusals : [];
      const capped = Math.min(Math.max(1, Number(limit) || 20), 50);
      return refusals.slice(0, capped);
    },

    getTreasury() {
      return client.getTreasury() || null;
    },

    getDashboardProjection() {
      const bundle = sdkModule.exportBundle(repoRoot, undefined, { receiptLimit: 10 });
      return sdkModule.projectForDashboard(bundle);
    },

    getFederationPeers() {
      const path = require("path");
      const fs = require("fs");
      const candidates = [
        path.join(repoRoot, "memory/federation.json"),
        path.join(repoRoot, "memory/peers.json"),
      ];
      for (const p of candidates) {
        try {
          const raw = fs.readFileSync(p, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.peers)) return parsed.peers;
          if (Array.isArray(parsed)) return parsed;
        } catch {}
      }
      return [];
    },

    readDashboardSnapshot() {
      return this.getDashboardProjection();
    },

    readWellKnown() {
      const path = require("path");
      const fs = require("fs");
      const p = path.join(repoRoot, "public/.well-known/orbit.json");
      try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      } catch {
        return null;
      }
    },
  };
}

module.exports = { adapt };
