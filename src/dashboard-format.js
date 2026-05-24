"use strict";

function truncateAddress(value, head = 6, tail = 4) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("0x") || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function relativeTime(iso, nowMs = Date.now()) {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  const diff = Math.round((nowMs - t) / 1000);
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 60) return `in ${ahead}s`;
    if (ahead < 3600) return `in ${Math.round(ahead / 60)} min`;
    if (ahead < 86400) return `in ${Math.round(ahead / 3600)}h`;
    return `in ${Math.round(ahead / 86400)}d`;
  }
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function nextCycleEstimate(lastActiveIso, intervalMin = 30, nowMs = Date.now()) {
  if (!lastActiveIso) return "unknown";
  const t = Date.parse(lastActiveIso);
  if (Number.isNaN(t)) return "unknown";
  const nextAt = t + intervalMin * 60 * 1000;
  const diff = Math.round((nextAt - nowMs) / 1000);
  if (diff <= 0) return "due now";
  if (diff < 60) return `~${diff}s`;
  if (diff < 3600) return `~${Math.round(diff / 60)} min`;
  return `~${Math.round(diff / 3600)}h`;
}

function formatAiUsage(receipt) {
  if (!receipt || typeof receipt !== "object") return "0";
  const tokens = Number(receipt.aiTokens || receipt.tokens || 0);
  const cost = Number(receipt.aiCostUsd || receipt.cost || 0);
  const parts = [];
  if (tokens > 0) parts.push(`${tokens.toLocaleString("en-US")} tokens`);
  if (cost > 0) parts.push(`$${cost.toFixed(3)}`);
  if (parts.length === 0) return "0";
  return parts.join(" / ");
}

function formatReceiptBlock(receipt, options = {}) {
  if (!receipt || typeof receipt !== "object") return "";
  const lines = [];
  const cycle = receipt.cycle != null ? `#${receipt.cycle}` : "#?";
  lines.push(`ORBIT CYCLE ${cycle}`);
  lines.push("-----------------");
  const trig = receipt.trigger;
  const triggerStr = typeof trig === "string"
    ? trig
    : trig && typeof trig === "object"
      ? (trig.type || trig.id || "unknown")
      : "unknown";
  lines.push(`Trigger:    ${triggerStr}`);
  lines.push(`Started:    ${receipt.startedAt || "-"}`);
  lines.push(`Finished:   ${receipt.finishedAt || "-"}`);
  lines.push(`Steps:      ${receipt.totalSteps || 0}`);
  if (receipt.filesChangedCount != null) {
    lines.push(`Files:      ${receipt.filesChangedCount}`);
  }
  if (receipt.signed && receipt.signer) {
    lines.push(`Signed by:  ${receipt.signer}`);
  } else {
    lines.push("Signed by:  unsigned");
  }
  if (receipt.payloadHash) {
    lines.push(`Hash:       ${receipt.payloadHash}`);
  }
  if (receipt.path) {
    const base = options.verifierCommand || "npx @orbit-house/verifier";
    lines.push(`Verify:     ${base} ${receipt.path}`);
  }
  return lines.join("\n");
}

function buildVerifyCommand(receipt, options = {}) {
  const base = options.command || "npx @orbit-house/verifier";
  if (!receipt || !receipt.path) return `${base} <receipt-url>`;
  return `${base} ${receipt.path}`;
}

function isBuildStale(generatedAt, thresholdHours = 2, nowMs = Date.now()) {
  if (!generatedAt) return false;
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return false;
  return (nowMs - t) > thresholdHours * 3600 * 1000;
}

const REFUSAL_CATEGORY_LABELS = {
  scam: "scam",
  safety: "safety",
  policy: "policy",
  "approval-missing": "approval missing",
  governance: "governance",
  unknown: "unknown"
};

function formatRefusalRow(entry, nowMs = Date.now()) {
  if (!entry || typeof entry !== "object") {
    return {
      cycle: "?",
      category: "unknown",
      categoryLabel: "unknown",
      severity: "medium",
      when: "unknown",
      summary: ""
    };
  }
  const rawCategory = String(entry.category || "unknown").toLowerCase();
  const category = REFUSAL_CATEGORY_LABELS[rawCategory] ? rawCategory : "unknown";
  const rawSeverity = String(entry.severity || "medium").toLowerCase();
  const severity = ["low", "medium", "high", "critical"].includes(rawSeverity) ? rawSeverity : "medium";
  const cycleNumber = Number(entry.cycle);
  const cycle = Number.isFinite(cycleNumber) && cycleNumber > 0 ? `#${cycleNumber}` : "#?";
  return {
    cycle,
    category,
    categoryLabel: REFUSAL_CATEGORY_LABELS[category],
    severity,
    when: relativeTime(entry.at, nowMs),
    summary: String(entry.oneLineSummary || "").slice(0, 120)
  };
}

module.exports = {
  truncateAddress,
  relativeTime,
  nextCycleEstimate,
  formatAiUsage,
  formatReceiptBlock,
  formatRefusalRow,
  buildVerifyCommand,
  isBuildStale
};
