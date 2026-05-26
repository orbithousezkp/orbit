#!/usr/bin/env node
"use strict";

// scripts/build-launch-folder.js
//
// Produces launch-ready/ — a clean snapshot of this repo containing
// ONLY what should be in the public-launch artifact:
//   - source code (src/, packages/, tests/, scripts/)
//   - CI workflows
//   - public docs (docs/, README, LICENSE, PUBLISHING)
//   - public-facing memory/* (identity.md, infrastructure.json,
//     ai-providers.json) and template stubs for everything else
//   - public dashboard inputs (public/, lore/genesis+voice+README)
//
// Stripped:
//   - PLAN/ (internal planning + sequencing)
//   - .remember/ + .claude/ (session memory)
//   - OWNER_ACTIONS.md, LAUNCH_PLAN.md drafts (operator runbooks)
//   - runtime/ (per-instance signed proofs, federation outbox)
//   - memory/* live state (state, treasury, governance, tasks,
//     approvals, adopters, knowledge, opportunities, missions,
//     horizon-*, errors.jsonl, cycles.jsonl, etc.) — replaced with
//     create-orbit-house templates so a clone produces a fresh
//     repo identical to what `npx create-orbit-house` would.
//   - lore/cycles-of-note/* specific entries (kept the README only)
//   - node_modules, dist, .env, .vscode
//
// Audit hook: the INCLUDE_GLOBS and STRIP_PATHS lists are the
// whitelist. Anything not matched is excluded by default. Adding
// something here is a deliberate, reviewable change.

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO_ROOT, "launch-ready");

// ----- whitelist -----
// Each entry is a top-level path under REPO_ROOT. Directories copy
// recursively. Files copy as-is. Anything not listed is excluded.

const INCLUDE_TOP_LEVEL = [
  // Source
  "src",
  "packages",
  "tests",
  "scripts",

  // CI
  ".github",

  // Public docs
  "docs",
  "README.md",
  "LICENSE",
  "PUBLISHING.md",

  // Public dashboard inputs
  "public",

  // Build config
  "package.json",
  "package-lock.json",
  "index.html",
  "vite.config.mjs",
  "tailwind.config.js",
  "postcss.config.js",
  ".gitignore",
  ".editorconfig",

  // Public-facing memory + lore (subset; filtered below)
  "memory",
  "lore",
];

// Within memory/, only these files survive — everything else gets a
// fresh template stub. The list is conservative: anything that
// reveals operational state or per-instance addresses is stripped.
const MEMORY_KEEP = new Set([
  "identity.md",
  "infrastructure.json",
  "ai-providers.json",   // declares supported providers; no keys
]);

// Within memory/, these get replaced with the create-orbit-house
// scaffolder's clean templates. A clone of launch-ready/ behaves
// like a fresh `npx create-orbit-house` repo.
const MEMORY_TEMPLATE_MAP = {
  "state.json": "state.json.tpl",
  "governance.json": "governance.json.tpl",
  "treasury.json": "treasury.json.tpl",
  "tasks.json": "tasks.json.tpl",
  "orbit-lineage.json": "orbit-lineage.json.tpl",
};

// Within lore/, only these survive. cycles-of-note/ has per-instance
// entries that don't belong in a launch-ready template — but its
// README stays so an adopter knows the directory's purpose.
const LORE_KEEP = new Set([
  "00-genesis.md",
  "voice.md",
  "README.md",
  "cycles-of-note/README.md",
]);

// Hard-strip — even if the parent dir is included, these never copy.
const STRIP_PATHS = new Set([
  ".env",
  ".env.local",
  ".env.production",
  "OWNER_ACTIONS.md",
  "PLAN",                          // entire dir — internal planning
  ".remember",
  ".claude",
  ".vscode",
  "runtime",                       // per-instance proofs/outbox
  "node_modules",
  "dist",
  "launch-ready",                  // recursive guard
  "tmp",
]);

// ----- helpers -----

function rmIfExists(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function isStripped(relPath) {
  const segments = relPath.split(path.sep);
  for (let i = 1; i <= segments.length; i++) {
    if (STRIP_PATHS.has(segments.slice(0, i).join(path.sep))) return true;
  }
  return STRIP_PATHS.has(segments[0]);
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(srcDir, destDir, filterFn) {
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const relFromRepo = path.relative(REPO_ROOT, srcPath);
    if (isStripped(relFromRepo)) continue;
    if (filterFn && !filterFn(relFromRepo, entry.isDirectory())) continue;
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, filterFn);
    } else if (entry.isFile()) {
      copyFile(srcPath, destPath);
    }
  }
}

// ----- per-directory handlers -----

function copyMemory() {
  const srcMem = path.join(REPO_ROOT, "memory");
  const destMem = path.join(OUT_DIR, "memory");
  ensureDir(destMem);

  if (!fs.existsSync(srcMem)) return { kept: 0, templated: 0, stripped: 0 };

  let kept = 0;
  let templated = 0;
  let stripped = 0;

  // 1. Copy explicit keepers
  for (const name of MEMORY_KEEP) {
    const src = path.join(srcMem, name);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(destMem, name));
      kept++;
    }
  }

  // 2. Write template stubs where the live file was internal-only
  const tplDir = path.join(REPO_ROOT, "packages/create-orbit-house/templates/memory");
  for (const [name, tplName] of Object.entries(MEMORY_TEMPLATE_MAP)) {
    const tpl = path.join(tplDir, tplName);
    if (fs.existsSync(tpl)) {
      // Render with neutral placeholders — these become real values
      // when an adopter runs the scaffolder.
      let body = fs.readFileSync(tpl, "utf-8");
      body = body
        .replace(/\{\{AGENT_NAME\}\}/g, "orbit")
        .replace(/\{\{MOTHERSHIP_REPO\}\}/g, "orbithousezkp/orbit")
        .replace(/\{\{OWNER_USERNAME\}\}/g, "")
        .replace(/\{\{NOW_ISO\}\}/g, new Date(0).toISOString())
        .replace(/\{\{[A-Z_]+\}\}/g, "");
      fs.writeFileSync(path.join(destMem, name), body, "utf-8");
      templated++;
    }
  }

  // 3. Count what was stripped (informational; everything else)
  for (const name of fs.readdirSync(srcMem)) {
    if (!MEMORY_KEEP.has(name) && !MEMORY_TEMPLATE_MAP[name]) stripped++;
  }

  return { kept, templated, stripped };
}

function copyLore() {
  const srcLore = path.join(REPO_ROOT, "lore");
  const destLore = path.join(OUT_DIR, "lore");
  ensureDir(destLore);
  if (!fs.existsSync(srcLore)) return { kept: 0, stripped: 0 };

  let kept = 0;
  let stripped = 0;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const src = path.join(dir, entry.name);
      const rel = path.relative(srcLore, src);
      if (entry.isDirectory()) {
        walk(src);
      } else if (entry.isFile()) {
        if (LORE_KEEP.has(rel)) {
          copyFile(src, path.join(destLore, rel));
          kept++;
        } else {
          stripped++;
        }
      }
    }
  }
  walk(srcLore);

  return { kept, stripped };
}

function copyPlainTopLevel(name) {
  const src = path.join(REPO_ROOT, name);
  const dest = path.join(OUT_DIR, name);
  if (!fs.existsSync(src)) return 0;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    let count = 0;
    copyDirRecursive(src, dest);
    function tally(p) {
      if (!fs.existsSync(p)) return;
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        const child = path.join(p, e.name);
        if (e.isDirectory()) tally(child);
        else if (e.isFile()) count++;
      }
    }
    tally(dest);
    return count;
  }
  copyFile(src, dest);
  return 1;
}

// ----- main -----

function main() {
  console.log(`building launch-ready/ at ${OUT_DIR}`);
  rmIfExists(OUT_DIR);
  ensureDir(OUT_DIR);

  const summary = {};
  for (const name of INCLUDE_TOP_LEVEL) {
    if (name === "memory") {
      summary.memory = copyMemory();
      continue;
    }
    if (name === "lore") {
      summary.lore = copyLore();
      continue;
    }
    summary[name] = copyPlainTopLevel(name);
  }

  // Print the manifest summary.
  console.log("");
  console.log("=== launch-ready manifest ===");
  for (const [k, v] of Object.entries(summary)) {
    if (typeof v === "number") {
      console.log(`  ${k.padEnd(20)}  ${v} file${v === 1 ? "" : "s"}`);
    } else {
      const parts = Object.entries(v).map(([kk, vv]) => `${kk}=${vv}`).join(" ");
      console.log(`  ${k.padEnd(20)}  ${parts}`);
    }
  }

  // Hard-strip post-check — anything in OUT_DIR matching the strip
  // list is a bug in the include filter.
  function audit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      const rel = path.relative(OUT_DIR, p);
      if (isStripped(rel)) {
        console.error(`AUDIT FAIL: stripped path leaked: ${rel}`);
        process.exit(1);
      }
      if (entry.isDirectory()) audit(p);
    }
  }
  audit(OUT_DIR);

  console.log("");
  console.log("audit: PASS");
  console.log(`done. inspect ${path.relative(REPO_ROOT, OUT_DIR)}/`);
}

main();
