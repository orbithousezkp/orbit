#!/usr/bin/env node
"use strict";

const { runStdioServer } = require("./src/server");

const repoRoot = process.env.ORBIT_REPO_ROOT || process.cwd();

runStdioServer({ repoRoot }).catch((err) => {
  process.stderr.write(`[orbit-mcp] fatal: ${err.message}\n`);
  process.exit(1);
});
