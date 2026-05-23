"use strict";

/**
 * AI Budget Ledger — persistence module.
 *
 * Simple JSON file read/write for ledger state.
 * No external dependencies.
 */

const fs = require("fs");
const path = require("path");

/**
 * Save ledger state to a JSON file.
 *
 * @param {string} filePath - Path to the JSON file
 * @param {object} ledger   - Ledger state
 */
function save(filePath, ledger) {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolved, JSON.stringify(ledger, null, 2) + "\n", "utf8");
}

/**
 * Load ledger state from a JSON file.
 *
 * @param {string} filePath - Path to the JSON file
 * @param {object} defaults - Default ledger state to merge with
 * @returns {object} ledger state
 */
function load(filePath, defaults = {}) {
  const resolved = path.resolve(filePath);
  try {
    const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
    return deepMerge(defaults, raw);
  } catch {
    return { ...defaults };
  }
}

/**
 * Shallow-safe deep merge: overlay wins, base provides structure.
 */
function deepMerge(base, overlay) {
  if (!overlay || typeof overlay !== "object" || Array.isArray(overlay)) return base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      merged[key] = deepMerge(base[key] || {}, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

module.exports = { save, load };
