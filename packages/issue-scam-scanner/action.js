"use strict";

const fs = require("fs");
const path = require("path");
const { buildReport, compileRule, scanText, formatSummary, validateCustomRule } = require("./scan");

function loadRulesFile(rulesPath) {
  if (!rulesPath) return [];
  const resolved = path.resolve(rulesPath);
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("rules-file must contain a JSON array of rule objects");
  }
  return parsed.map((rule, index) => {
    const valid = validateCustomRule(rule, index);
    if (valid !== true) throw new Error(valid);
    return compileRule(rule);
  });
}

// GitHub Actions runtime: read from process.env or core
// This is a minimal entrypoint for the action
async function run() {
  let core;
  try {
    core = require("@actions/core");
  } catch {
    // Not running inside Actions — use a stub
    core = {
      getInput: (name) => process.env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`] || "",
      setOutput: (name, value) => console.log(`::set-output name=${name}::${value}`),
      info: (msg) => console.log(msg),
      warning: (msg) => console.warn(msg),
      setFailed: (msg) => { console.error(msg); process.exitCode = 1; }
    };
  }

  const title = core.getInput("issue-title") || "";
  const body = core.getInput("issue-body") || "";
  const comment = core.getInput("comment-body") || "";
  const threshold = parseInt(core.getInput("threshold") || "70", 10);
  const quarantineThreshold = parseInt(core.getInput("quarantine-threshold") || String(threshold), 10);
  const blockThreshold = parseInt(core.getInput("block-threshold") || "90", 10);
  const rulesFile = core.getInput("rules-file") || "";

  const combined = [title, body, comment].filter(Boolean).join("\n\n");
  if (!combined.trim()) {
    core.info("No input text provided — skipping scan.");
    core.setOutput("safe", "true");
    core.setOutput("score", "0");
    core.setOutput("level", "clear");
    core.setOutput("flags", "[]");
    return;
  }

  const customRules = loadRulesFile(rulesFile);
  const options = {
    threshold,
    quarantineThreshold,
    blockThreshold,
    customRules: customRules.length ? customRules : undefined
  };
  const result = scanText(combined, options);
  const report = buildReport(combined, options);
  const aboveThreshold = result.flags.filter((f) => f.severity >= threshold);

  core.setOutput("safe", aboveThreshold.length === 0 ? "true" : "false");
  core.setOutput("action", report.action);
  core.setOutput("score", String(result.score));
  core.setOutput("level", result.level);
  core.setOutput("flags", JSON.stringify(result.flags));
  core.setOutput("report", JSON.stringify(report));

  if (aboveThreshold.length > 0) {
    core.warning(formatSummary(result, "Orbit Intake Guardrail"));
  } else {
    core.info(formatSummary(result, "Orbit Intake Guardrail"));
  }
}

run().catch((err) => {
  console.error("Scanner action failed:", err);
  process.exitCode = 1;
});

module.exports = { run };
