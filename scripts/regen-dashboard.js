#!/usr/bin/env node
"use strict";

// scripts/regen-dashboard.js — regenerate public/dashboard.json from
// the current memory/ state using the SDK's projectForDashboard.
//
// The cycle does this automatically every 15 min, but operators need
// a way to refresh the dashboard from disk state without waiting for
// the next cron firing — e.g., after a Patch Set adds new slices to
// the SDK projection (Patch S added handoff + errors).
//
//   npm run dashboard:regen     # writes public/dashboard.json
//   npm run dashboard:regen --  --check    # prints to stdout, no write

const fs = require("node:fs");
const path = require("node:path");
const { exportBundle, projectForDashboard } = require("../packages/orbit-sdk/index.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(REPO_ROOT, "public/dashboard.json");

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");

  const bundle = exportBundle(REPO_ROOT, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);
  const out = JSON.stringify(slim, null, 2) + "\n";

  if (checkOnly) {
    process.stdout.write(out);
    return;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, out, "utf-8");
  console.log(`regenerated ${path.relative(REPO_ROOT, OUT_PATH)} (digest=${slim.digest})`);
  // Quick summary of slices included.
  const keys = Object.keys(slim).filter((k) => k !== "digest");
  console.log(`slices: ${keys.join(", ")}`);
}

main();
