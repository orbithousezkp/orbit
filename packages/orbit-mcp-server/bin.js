#!/usr/bin/env node
"use strict";

/**
 * Orbit MCP server entrypoint.
 *
 * Cycle 96 direction choice:
 * - Compared build, earn, infrastructure, sustain, and grow.
 * - Selected infrastructure because the MCP bridge is an active adoption surface
 *   for the repository control plane, and its executable entrypoint should make
 *   the safety boundary obvious before clients wire it into IDEs or agents.
 *
 * Boundary: this process exposes SDK-backed read-only tools/resources. It does
 * not spend, sign, launch tokens, claim rewards, change payout routes, publish,
 * post outreach, or create external commitments. Future write or execution
 * tools require a separate approval-gated design and explicit live config.
 */

const { runStdioServer } = require("./src/server");

const repoRoot = process.env.ORBIT_REPO_ROOT || process.cwd();

runStdioServer({ repoRoot }).catch((err) => {
  process.stderr.write(`[orbit-mcp] fatal: ${err.message}\n`);
  process.exit(1);
});
