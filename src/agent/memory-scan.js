"use strict";

// F-1.3 (PLAN/ROADMAP_EXPANSION.md): memory file integrity scanner.
//
// Read-only sweep of memory/*.json before a cycle trusts them. Catches
// corruption / drift that would otherwise surface as a confusing mid-cycle
// crash: a half-written file (parse error), a zero-byte file from a failed
// write, an atomic-write temp that leaked, a missing required ledger, or a
// top-level key that drifted out of a known schema.
//
// Best-effort and never throws — the caller may run this in a cycle's
// pre-flight and should treat a thrown error as worse than a returned issue
// list. Pairs with safety.atomicWriteFile (the tmp_leftover check looks for
// that helper's temp pattern).

const fs = require("node:fs");
const path = require("node:path");

const MEMORY_DIR = "memory";

function scanMemoryIntegrity(repoRoot, options = {}) {
  if (!repoRoot) {
    return { ok: false, healthy: false, reason: "no_repo_root", issues: [], scanned: 0 };
  }
  const memoryDir = path.resolve(repoRoot, options.memoryDir || MEMORY_DIR);

  let dirents;
  try {
    dirents = fs.readdirSync(memoryDir, { withFileTypes: true });
  } catch {
    return { ok: false, healthy: false, reason: "memory_dir_missing", issues: [], scanned: 0 };
  }

  const required = Array.isArray(options.required) ? options.required : [];
  const schemas = options.schemas && typeof options.schemas === "object" ? options.schemas : {};
  const issues = [];
  const present = new Set();
  let scanned = 0;

  for (const dirent of dirents) {
    if (!dirent.isFile()) continue;
    const name = dirent.name;

    // Atomic-write temp leftover (safety.atomicWriteFile pattern: ".<name>.tmp.<rand>").
    if (/\.tmp\./.test(name)) {
      issues.push({ file: name, kind: "tmp_leftover", detail: "leftover atomic-write temp file" });
      continue;
    }

    if (!name.endsWith(".json")) continue;
    present.add(name);
    scanned += 1;

    const absPath = path.join(memoryDir, name);
    let raw;
    try {
      raw = fs.readFileSync(absPath, "utf-8");
    } catch (err) {
      issues.push({ file: name, kind: "read_error", detail: err.message });
      continue;
    }

    if (raw.trim().length === 0) {
      issues.push({ file: name, kind: "empty_file", detail: "file is empty (likely failed write)" });
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      issues.push({ file: name, kind: "parse_error", detail: err.message });
      continue;
    }

    // Optional schema check: required top-level keys present.
    const requiredKeys = schemas[name];
    if (Array.isArray(requiredKeys) && parsed && typeof parsed === "object") {
      const missingKeys = requiredKeys.filter(
        (key) => !Object.prototype.hasOwnProperty.call(parsed, key)
      );
      if (missingKeys.length > 0) {
        issues.push({
          file: name,
          kind: "key_drift",
          detail: `missing top-level key(s): ${missingKeys.join(", ")}`
        });
      }
    }
  }

  // Required files that never appeared.
  for (const requiredFile of required) {
    if (!present.has(requiredFile)) {
      issues.push({ file: requiredFile, kind: "missing", detail: "required memory file not found" });
    }
  }

  return {
    ok: true,
    healthy: issues.length === 0,
    issues,
    scanned
  };
}

module.exports = {
  MEMORY_DIR,
  scanMemoryIntegrity
};
