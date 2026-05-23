"use strict";

const { RISK_PATTERNS, SHORTENER_DOMAINS, SAFE_DOMAINS } = require("./rules");

/**
 * Extract all http(s) URLs from text.
 */
function extractUrls(text) {
  return Array.from(String(text || "").matchAll(/\bhttps?:\/\/[^\s<>"')]+/gi)).map((m) => m[0]);
}

/**
 * Get the domain from a URL string.
 */
function domainOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Scan a single URL for risk signals.
 */
function scanUrl(url) {
  const domain = domainOf(url);
  const flags = [];

  if (!domain) {
    flags.push({ severity: 50, category: "malformed_url", message: "URL could not be parsed.", url });
  } else if (SHORTENER_DOMAINS.has(domain)) {
    flags.push({ severity: 80, category: "shortened_url", message: "Shortened links hide the final destination.", url, domain });
  } else if (!SAFE_DOMAINS.has(domain) && /wallet|claim|airdrop|reward|token|swap|bridge|approve/i.test(url)) {
    flags.push({ severity: 70, category: "unknown_financial_domain", message: "Unknown financial or wallet-related domain.", url, domain });
  }

  if (/[^\x20-\x7e]/.test(url)) {
    flags.push({ severity: 65, category: "unicode_url", message: "URL contains non-ASCII characters.", url, domain });
  }

  return flags;
}

/**
 * Map a numeric severity score to a human-readable risk level.
 */
function riskLevel(score) {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score > 0) return "low";
  return "clear";
}

/**
 * Scan text for all risk patterns and URL risks.
 * Returns { safe, level, score, flags }.
 */
function scanText(text) {
  const value = String(text || "");
  const flags = [];

  for (const rule of RISK_PATTERNS) {
    if (rule.pattern.test(value)) {
      flags.push({
        severity: rule.severity,
        category: rule.category,
        message: rule.message
      });
    }
  }

  for (const url of extractUrls(value)) {
    flags.push(...scanUrl(url));
  }

  const score = flags.reduce((max, f) => Math.max(max, f.severity), 0);
  return {
    safe: score < 70,
    level: riskLevel(score),
    score,
    flags
  };
}

/**
 * Scan a GitHub issue/PR event payload.
 * Accepts { title, body, user, labels, comments[] }.
 * Returns { safe, level, score, flags, parts }.
 */
function scanEvent(event = {}) {
  const parts = {};

  if (event.title) parts.title = scanText(event.title);
  if (event.body) parts.body = scanText(event.body);

  if (Array.isArray(event.comments)) {
    parts.comments = event.comments.map((c, i) => ({
      index: i,
      user: c.user || null,
      ...(c.body ? scanText(c.body) : { safe: true, level: "clear", score: 0, flags: [] })
    }));
  }

  const allScores = [
    parts.title?.score || 0,
    parts.body?.score || 0,
    ...(parts.comments || []).map((c) => c.score || 0)
  ];
  const score = Math.max(...allScores);

  return {
    safe: score < 70,
    level: riskLevel(score),
    score,
    flags: [
      ...(parts.title?.flags || []),
      ...(parts.body?.flags || []),
      ...((parts.comments || []).flatMap((c) => c.flags || []))
    ],
    parts
  };
}

/**
 * Format a scan result as a short summary string.
 */
function formatSummary(result, label = "") {
  const prefix = label ? `[${label}] ` : "";
  if (result.safe) {
    return `${prefix}Clear — no risk flags detected.`;
  }
  const categories = [...new Set(result.flags.map((f) => f.category))];
  return `${prefix}${result.level.toUpperCase()} (score ${result.score}) — flagged: ${categories.join(", ")}`;
}

module.exports = {
  extractUrls,
  domainOf,
  scanUrl,
  scanText,
  scanEvent,
  formatSummary,
  riskLevel
};
