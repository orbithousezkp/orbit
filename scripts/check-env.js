#!/usr/bin/env node
"use strict";

// scripts/check-env.js — enforces D-021: `.env` contains no secrets.
//
// Scans every `.env` and nested `.env*` file in the repo (excluding
// `.env.example` and `.env.example.tpl` which are placeholder docs,
// and anything under node_modules / launch-ready / dist). For each:
//   1. Any key listed in DENY_KEYS is rejected even if value is empty
//      — the NAME itself signals intent to put a secret here.
//   2. Any RHS value matching a SECRET_PATTERN is rejected.
//   3. Empty values for any key are allowed (.env can declare names
//      without values for local-dev convenience).
//
// Exit 0 = clean. Exit 1 = secret-shaped content detected; prints
// offending file:line and the matched rule. Never prints the actual
// value — would defeat the purpose.

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");

// Env var names whose mere presence in .env is forbidden — even an
// empty placeholder line "ORBIT_WALLET_PRIVATE_KEY=" is a smell.
// Keep this list IN SYNC with the manifest in .env.example §2.
const DENY_KEYS = new Set([
  "ORBIT_AI_PROVIDER_KEYS",
  "ORBIT_AI_PROVIDERS",
  "ORBIT_WEB_SEARCH_KEY",
  "ORBIT_WALLET_PRIVATE_KEY",
  "ORBIT_FARCASTER_NEYNAR_API_KEY",
  "ORBIT_FARCASTER_SIGNER_UUID",
  "ORBIT_SPAWN_TOKEN",
  "NPM_TOKEN",
  "PRIVATE_ROUTE_1_API_KEY",
  "PRIVATE_ROUTE_2_API_KEY",
  // GITHUB_TOKEN is provided by Actions; setting it locally is fine
  // for dev but using a real PAT is a footgun. Block to be safe.
  "GITHUB_TOKEN",
]);

// RHS content that looks like a real secret — matches even if the
// key is a benign name (paranoid catch).
const SECRET_PATTERNS = [
  { name: "RSA/EC/OpenSSH/PGP private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i },
  { name: "GitHub PAT (classic)",       re: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { name: "GitHub fine-grained PAT",    re: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { name: "OpenAI-style API key",       re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "AWS access key",             re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "0x… 64-hex private key",     re: /\b0x[0-9a-fA-F]{64}\b/ },
  { name: "npm automation token",       re: /\bnpm_[A-Za-z0-9]{30,}\b/ },
];

const SKIP_DIRS = new Set(["node_modules", "launch-ready", "dist", ".git"]);
const SKIP_FILES = new Set([".env.example"]);
const SKIP_EXTENSIONS = new Set([".tpl"]);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile()) {
      const base = path.basename(p);
      const ext = path.extname(base);
      if (SKIP_FILES.has(base)) continue;
      if (SKIP_EXTENSIONS.has(ext)) continue;
      if (base === ".env" || base.startsWith(".env.")) {
        out.push(p);
      }
    }
  }
  return out;
}

function scanFile(absPath) {
  const findings = [];
  let body;
  try { body = fs.readFileSync(absPath, "utf-8"); }
  catch (err) {
    findings.push({ line: 0, rule: "unreadable", detail: err.message });
    return findings;
  }
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2];
    if (DENY_KEYS.has(key)) {
      findings.push({
        line: i + 1,
        rule: "deny_key",
        detail: `${key} must NOT appear in .env. Move to GitHub Secrets / Variables.`
      });
      continue;
    }
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(value)) {
        findings.push({
          line: i + 1,
          rule: "secret_pattern",
          detail: `${key} value matches "${name}" — sensitive data must NOT be in .env.`
        });
        break;
      }
    }
  }
  return findings;
}

function main() {
  const files = walk(REPO_ROOT, []);
  if (files.length === 0) {
    console.log("# env:check · no .env files found");
    return 0;
  }
  let total = 0;
  for (const f of files) {
    const findings = scanFile(f);
    if (findings.length === 0) continue;
    total += findings.length;
    console.log("");
    console.log(`✗ ${path.relative(REPO_ROOT, f)}`);
    for (const v of findings) {
      console.log(`  line ${v.line}  [${v.rule}]  ${v.detail}`);
    }
  }
  if (total === 0) {
    console.log(`# env:check · ${files.length} file(s) scanned · clean`);
    return 0;
  }
  console.log("");
  console.log(`# env:check · ${total} violation(s) across ${files.length} file(s) — D-021`);
  return 1;
}

process.exit(main());
