"use strict";

/**
 * Proof Viewer — core library
 *
 * Loads, summarizes, lists, and searches agent cycle proof records
 * from the runtime/proofs/ directory tree.
 *
 * Zero external dependencies.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Proof loading
// ---------------------------------------------------------------------------

/**
 * Load a single proof JSON file by path.
 * Returns null if the file does not exist or cannot be parsed.
 */
function loadProof(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Discover and load all proof files from a proof root directory.
 * Expects structure: <root>/<YYYY-MM-DD>/<ISO-timestamp>.json
 *
 * @param {string} proofRoot - Path to the runtime/proofs directory
 * @returns {Array<{ filePath: string, proof: object }>} sorted oldest-first
 */
function loadAllProofs(proofRoot) {
  const results = [];

  if (!fs.existsSync(proofRoot) || !fs.statSync(proofRoot).isDirectory()) {
    return results;
  }

  const dateDirs = fs.readdirSync(proofRoot).filter((d) => {
    const full = path.join(proofRoot, d);
    return fs.statSync(full).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d);
  }).sort();

  for (const dateDir of dateDirs) {
    const fullDir = path.join(proofRoot, dateDir);
    const files = fs.readdirSync(fullDir).filter((f) => f.endsWith(".json")).sort();

    for (const file of files) {
      const filePath = path.join(fullDir, file);
      const proof = loadProof(filePath);
      if (proof) {
        results.push({ filePath, proof });
      }
    }
  }

  return results;
}

/**
 * Load the most recent N proofs from a proof root directory.
 */
function loadRecentProofs(proofRoot, count = 5) {
  const all = loadAllProofs(proofRoot);
  return all.slice(-count);
}

// ---------------------------------------------------------------------------
// Proof summarization
// ---------------------------------------------------------------------------

/**
 * Summarize a single proof record into a structured object.
 */
function summarizeProof(proof) {
  if (!proof || typeof proof !== "object") {
    return null;
  }

  const steps = Array.isArray(proof.steps) ? proof.steps : [];
  const filesChanged = Array.isArray(proof.filesChanged) ? proof.filesChanged : [];

  // Collect tool calls across all steps
  const toolCalls = [];
  for (const step of steps) {
    if (Array.isArray(step.toolCalls)) {
      for (const tc of step.toolCalls) {
        toolCalls.push(tc.name || tc.tool || "unknown");
      }
    }
    if (step.tool) {
      toolCalls.push(step.tool);
    }
  }

  // Compute duration
  let durationMs = null;
  if (proof.startedAt && proof.finishedAt) {
    const start = new Date(proof.startedAt).getTime();
    const end = new Date(proof.finishedAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      durationMs = end - start;
    }
  }

  // Collect unique tool names
  const uniqueTools = [...new Set(toolCalls)];

  // Estimate total cost
  let totalCostUsd = 0;
  for (const s of steps) {
    if (s.estimatedUsd && typeof s.estimatedUsd === "number") {
      totalCostUsd += s.estimatedUsd;
    }
  }

  // Check for fallback mode
  const fallbackSteps = steps.filter((s) => s.fallback === true);
  const usedFallback = fallbackSteps.length > 0;

  // Trigger info
  const trigger = proof.trigger || {};

  return {
    brand: proof.brand || "unknown",
    cycle: proof.cycle ?? null,
    startedAt: proof.startedAt || null,
    finishedAt: proof.finishedAt || null,
    durationMs,
    durationFormatted: durationMs !== null ? formatDuration(durationMs) : null,
    trigger: {
      type: trigger.type || "unknown",
      id: trigger.id || null,
      label: trigger.label || null,
    },
    result: proof.result || null,
    totalSteps: proof.totalSteps ?? steps.length,
    toolCallsCount: toolCalls.length,
    uniqueTools,
    filesChangedCount: filesChanged.length,
    filesChanged,
    totalCostUsd: totalCostUsd > 0 ? totalCostUsd : null,
    usedFallback,
    dryRun: proof.dryRun ?? false,
  };
}

/**
 * Format a summary as a compact human-readable string.
 */
function formatSummary(summary) {
  if (!summary) return "Invalid proof record.";

  const lines = [];
  lines.push(`Cycle #${summary.cycle ?? "?"} — ${summary.brand}`);
  lines.push(`Trigger: ${summary.trigger.label || summary.trigger.type || "unknown"}`);
  lines.push(`Started: ${summary.startedAt || "unknown"}`);

  if (summary.durationFormatted) {
    lines.push(`Duration: ${summary.durationFormatted}`);
  }

  lines.push(`Steps: ${summary.totalSteps} | Tool calls: ${summary.toolCallsCount}`);

  if (summary.uniqueTools.length > 0) {
    lines.push(`Tools used: ${summary.uniqueTools.join(", ")}`);
  }

  if (summary.filesChangedCount > 0) {
    lines.push(`Files changed: ${summary.filesChangedCount}`);
  }

  if (summary.totalCostUsd !== null) {
    lines.push(`Estimated AI cost: $${summary.totalCostUsd.toFixed(6)}`);
  }

  if (summary.usedFallback) {
    lines.push(`Mode: deterministic fallback (no AI provider)`);
  }

  if (summary.dryRun) {
    lines.push(`Mode: DRY RUN`);
  }

  if (summary.result) {
    lines.push(`Result: ${summary.result}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search proofs by criteria.
 *
 * @param {Array} proofEntries - Array of { filePath, proof } objects
 * @param {object} criteria - Search criteria
 * @param {number} [criteria.cycle] - Match cycle number
 * @param {string} [criteria.triggerType] - Match trigger type (state, event, mandatory)
 * @param {string} [criteria.triggerId] - Match trigger id
 * @param {string} [criteria.date] - Match date prefix (YYYY-MM-DD)
 * @param {boolean} [criteria.fallback] - Match fallback mode
 * @param {boolean} [criteria.dryRun] - Match dry run mode
 * @param {string} [criteria.tool] - Match tool name used in any step
 * @param {string} [criteria.fileChanged] - Match a file path in filesChanged
 * @param {string} [criteria.resultContains] - Match text in result
 * @returns {Array} matching proofs with summaries
 */
function searchProofs(proofEntries, criteria) {
  const results = [];

  for (const { filePath, proof } of proofEntries) {
    const summary = summarizeProof(proof);
    if (!summary) continue;

    let match = true;

    if (criteria.cycle !== undefined && criteria.cycle !== null) {
      if (summary.cycle !== criteria.cycle) match = false;
    }

    if (criteria.triggerType && summary.trigger.type !== criteria.triggerType) {
      match = false;
    }

    if (criteria.triggerId && summary.trigger.id !== criteria.triggerId) {
      match = false;
    }

    if (criteria.date) {
      if (!filePath.includes(criteria.date)) match = false;
    }

    if (criteria.fallback !== undefined && criteria.fallback !== null) {
      if (summary.usedFallback !== criteria.fallback) match = false;
    }

    if (criteria.dryRun !== undefined && criteria.dryRun !== null) {
      if (summary.dryRun !== criteria.dryRun) match = false;
    }

    if (criteria.tool) {
      if (!summary.uniqueTools.includes(criteria.tool)) match = false;
    }

    if (criteria.fileChanged) {
      const found = summary.filesChanged.some(
        (f) => f.includes(criteria.fileChanged)
      );
      if (!found) match = false;
    }

    if (criteria.resultContains) {
      const haystack = (summary.result || "").toLowerCase();
      if (!haystack.includes(criteria.resultContains.toLowerCase())) match = false;
    }

    if (match) {
      results.push({ filePath, proof, summary });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Aggregate statistics
// ---------------------------------------------------------------------------

/**
 * Compute aggregate stats across multiple proof records.
 */
function aggregateStats(proofEntries) {
  const summaries = proofEntries
    .map((e) => summarizeProof(e.proof))
    .filter(Boolean);

  if (summaries.length === 0) {
    return {
      count: 0,
      firstCycle: null,
      lastCycle: null,
      totalSteps: 0,
      totalToolCalls: 0,
      totalFilesChanged: 0,
      totalCostUsd: 0,
      fallbackCount: 0,
      triggerBreakdown: {},
      topTools: [],
    };
  }

  const triggerBreakdown = {};
  const toolCounts = {};
  let totalSteps = 0;
  let totalToolCalls = 0;
  let totalFilesChanged = 0;
  let totalCostUsd = 0;
  let fallbackCount = 0;

  for (const s of summaries) {
    totalSteps += s.totalSteps;
    totalToolCalls += s.toolCallsCount;
    totalFilesChanged += s.filesChangedCount;
    if (s.totalCostUsd !== null) totalCostUsd += s.totalCostUsd;
    if (s.usedFallback) fallbackCount++;

    const triggerKey = `${s.trigger.type}:${s.trigger.id || "?"}`;
    triggerBreakdown[triggerKey] = (triggerBreakdown[triggerKey] || 0) + 1;

    for (const tool of s.uniqueTools) {
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
    }
  }

  // Top tools sorted by frequency
  const topTools = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    count: summaries.length,
    firstCycle: summaries[0].cycle,
    lastCycle: summaries[summaries.length - 1].cycle,
    totalSteps,
    totalToolCalls,
    totalFilesChanged,
    totalCostUsd,
    fallbackCount,
    triggerBreakdown,
    topTools,
  };
}

/**
 * Format aggregate stats as human-readable text.
 */
function formatAggregate(stats) {
  if (stats.count === 0) return "No proof records found.";

  const lines = [];
  lines.push(`Proof Records: ${stats.count}`);
  lines.push(`Cycles: #${stats.firstCycle ?? "?"} to #${stats.lastCycle ?? "?"}`);
  lines.push(`Total steps: ${stats.totalSteps}`);
  lines.push(`Total tool calls: ${stats.totalToolCalls}`);
  lines.push(`Total files changed: ${stats.totalFilesChanged}`);
  lines.push(`Total estimated AI cost: $${stats.totalCostUsd.toFixed(6)}`);

  if (stats.fallbackCount > 0) {
    lines.push(`Fallback cycles: ${stats.fallbackCount}`);
  }

  const triggerEntries = Object.entries(stats.triggerBreakdown);
  if (triggerEntries.length > 0) {
    lines.push(`\nTrigger breakdown:`);
    for (const [key, count] of triggerEntries) {
      lines.push(`  ${key}: ${count}`);
    }
  }

  if (stats.topTools.length > 0) {
    lines.push(`\nTop tools:`);
    for (const t of stats.topTools) {
      lines.push(`  ${t.name}: ${t.count} calls`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadProof,
  loadAllProofs,
  loadRecentProofs,
  summarizeProof,
  formatSummary,
  searchProofs,
  aggregateStats,
  formatAggregate,
  formatDuration,
};
