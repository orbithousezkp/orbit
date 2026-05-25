#!/usr/bin/env node
"use strict";

// CLI for adopter registry management.
//
// Usage:
//   node src/cli/orbit-adopter.js add --repo owner/name --well-known URL [--public-url URL] [--note "..."]
//   node src/cli/orbit-adopter.js list [--json]
//   node src/cli/orbit-adopter.js verify --repo owner/name
//   node src/cli/orbit-adopter.js remove --repo owner/name

const fs = require("fs");
const path = require("path");
const {
  buildEmptyRegistry,
  readRegistry,
  upsertAdopter,
  reverifyAdopters,
  projectAdoptersForDashboard
} = require("../agent/adopters");

const REGISTRY_PATH = path.resolve(process.cwd(), "memory/adopters-registry.json");

function readRegistryFile() {
  try {
    return readRegistry(JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")));
  } catch {
    return buildEmptyRegistry();
  }
}

function writeRegistryFile(registry) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args.flags[key] = true;
      } else {
        args.flags[key] = next;
        i += 1;
      }
    } else {
      args.positional.push(a);
    }
  }
  return args;
}

function usage() {
  process.stdout.write(`orbit-adopter [command] [options]

Commands:
  add        Add an adopter to the registry
  list       List registered adopters
  verify     Re-fetch and re-validate all adopters' three criteria
  remove     Remove an adopter by repo

Options:
  --repo <owner/name>      Adopter repo
  --well-known <url>       URL of the adopter's /.well-known/orbit.json
  --public-url <url>       Public base URL (e.g. https://example.com)
  --note <string>          Free-form note
  --json                   Output as JSON (list command only)
`);
}

async function cmdAdd(flags) {
  if (!flags.repo) throw new Error("--repo required");
  const registry = readRegistryFile();
  const next = upsertAdopter(registry, {
    repo: flags.repo,
    wellKnownUrl: flags["well-known"] || null,
    publicUrl: flags["public-url"] || null,
    handshakeAttemptedAt: new Date().toISOString(),
    status: "manually-added",
    adopted: false,
    criteriaStatus: { cycle7d: null, dashboardReachable: null, wellKnownValid: null },
    note: flags.note || null
  });
  writeRegistryFile(next);
  process.stdout.write(`added ${flags.repo} (${next.adopters.length} total)\n`);
}

function cmdList(flags) {
  const registry = readRegistryFile();
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(projectAdoptersForDashboard(registry), null, 2)}\n`);
    return;
  }
  const slim = projectAdoptersForDashboard(registry);
  process.stdout.write(`adopters: ${slim.adopted} verified / ${slim.total} total (phase 1 target: ${slim.phase1Target})\n`);
  for (const a of registry.adopters) {
    const status = a.adopted ? "✓ adopted" : (a.status || "pending");
    process.stdout.write(`  - ${a.repo || "(no repo)"} — ${status}\n`);
  }
}

async function cmdVerify() {
  const fetchJson = async (url) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(t);
    }
  };
  const registry = readRegistryFile();
  const next = await reverifyAdopters({ registry, fetchJson });
  writeRegistryFile(next);
  const slim = projectAdoptersForDashboard(next);
  process.stdout.write(`verified: ${slim.adopted} of ${slim.total} adopters meet all three criteria\n`);
}

function cmdRemove(flags) {
  if (!flags.repo) throw new Error("--repo required");
  const registry = readRegistryFile();
  const before = registry.adopters.length;
  registry.adopters = registry.adopters.filter((a) => a.repo !== flags.repo);
  registry.updatedAt = new Date().toISOString();
  writeRegistryFile(registry);
  process.stdout.write(`removed ${flags.repo} (${before - registry.adopters.length} entry/entries dropped)\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    usage();
    return;
  }
  const { positional, flags } = parseArgs(argv);
  const cmd = positional[0];
  switch (cmd) {
    case "add":
      await cmdAdd(flags);
      return;
    case "list":
      cmdList(flags);
      return;
    case "verify":
      await cmdVerify();
      return;
    case "remove":
      cmdRemove(flags);
      return;
    default:
      usage();
      process.exit(2);
  }
}

main().catch((err) => {
  process.stderr.write(`[orbit-adopter] ${err.message}\n`);
  process.exit(1);
});
