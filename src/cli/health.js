#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../agent/config");
const { assertNoSymlinkPath, containsSecret, readSafeTextFile } = require("../agent/safety");

const config = loadConfig();

const requiredFiles = [
  "README.md",
  "package.json",
  "src/agent/run.js",
  "src/agent/ai-food.js",
  "src/agent/safety.js",
  "memory/identity.md",
  "memory/ai-providers.json",
  "memory/knowledge.json",
  "memory/opportunities.json",
  "memory/problem-lab.json",
  "memory/project-ideas.json",
  "memory/agent-sources.json",
  "memory/idea-inbox.json",
  "memory/tasks.json",
  "memory/treasury.json",
  "src/agent/clanker.js",
  "src/agent/features.js",
  "src/agent/governance.js",
  "src/agent/learning-lab.js",
  "src/agent/scam.js",
  "src/agent/treasury.js",
  "docs/learning-lab.md",
  "docs/index.html",
  "docs/workflow-demo.html",
  "docs/feature-map.html",
  ".github/workflows/orbit-cycle.yml",
  ".github/workflows/orbit-event.yml"
];

function exists(relativePath) {
  try {
    const { resolved } = assertNoSymlinkPath(config.repoRoot, relativePath);
    return fs.existsSync(resolved);
  } catch {
    return false;
  }
}

function read(relativePath) {
  return readSafeTextFile(config.repoRoot, relativePath);
}

const results = [];

for (const file of requiredFiles) {
  results.push({
    name: `file:${file}`,
    ok: exists(file),
    detail: exists(file) ? "present" : "missing"
  });
}

const pkg = JSON.parse(read("package.json"));
results.push({
  name: "package-name",
  ok: pkg.name === "orbit",
  detail: pkg.name
});

const envWarnings = [];
if (!config.aiProviders.length) envWarnings.push("ORBIT_AI_PROVIDERS not configured; cycle will use deterministic fallback");
if (!config.githubRepository) envWarnings.push("GITHUB_REPOSITORY not set; GitHub issue tools will be inactive");
if (config.enableTokenLaunch && !config.walletPrivateKey) envWarnings.push("token launch enabled but ORBIT_WALLET_PRIVATE_KEY is missing");
if (config.enableTokenLaunch && !config.operatorRevenueAddress) envWarnings.push("token launch enabled but ORBIT_OPERATOR_REVENUE_ADDRESS is missing");
if (config.enableRevenueClaims && !config.operatorRevenueAddress) envWarnings.push("revenue claims enabled but ORBIT_OPERATOR_REVENUE_ADDRESS is missing");

results.push({
  name: "runtime-config",
  ok: true,
  detail: envWarnings.length ? envWarnings.join("; ") : "ready"
});

const sampleFiles = ["README.md", ".env.example", "memory/identity.md"];
const secretHit = sampleFiles.find((file) => containsSecret(read(file)));
results.push({
  name: "secret-scan",
  ok: !secretHit,
  detail: secretHit ? `secret-like content found in ${secretHit}` : "no obvious secrets in baseline files"
});

let failed = false;
for (const result of results) {
  const marker = result.ok ? "OK" : "FAIL";
  console.log(`${marker} ${result.name} - ${result.detail}`);
  failed = failed || !result.ok;
}

process.exit(failed ? 1 : 0);
