"use strict";

const { scanText, formatSummary } = require("./scan");

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

  const combined = [title, body, comment].filter(Boolean).join("\n\n");
  if (!combined.trim()) {
    core.info("No input text provided — skipping scan.");
    core.setOutput("safe", "true");
    core.setOutput("score", "0");
    core.setOutput("level", "clear");
    core.setOutput("flags", "[]");
    return;
  }

  // Pass threshold through so safe/unsafe respects the configured level
  const result = scanText(combined, { threshold });

  core.setOutput("safe", result.safe ? "true" : "false");
  core.setOutput("score", String(result.score));
  core.setOutput("level", result.level);
  core.setOutput("flags", JSON.stringify(result.flags));

  if (!result.safe) {
    core.warning(formatSummary(result, "Issue Scam Scanner"));
  } else {
    core.info(formatSummary(result, "Issue Scam Scanner"));
  }
}

run().catch((err) => {
  console.error("Scanner action failed:", err);
  process.exitCode = 1;
});

module.exports = { run };
