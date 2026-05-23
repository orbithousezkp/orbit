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
 * Validate a custom rule object. Returns true if valid, or a string error message.
 */
function validateCustomRule(rule, index) {
  if (!rule || typeof rule !== "object") {
    return `Rule at index ${index} is not an object.`;
  }
  if (typeof rule.severity !== "number" || rule.severity < 0 || rule.severity > 100) {
    return `Rule at index ${index} ("${rule.category || "?"}") has invalid severity (expected 0-100).`;
  }
  if (typeof rule.category !== "string" || !rule.category.trim()) {
    return `Rule at index ${index} has missing or empty category.`;
  }
  if (typeof rule.message !== "string" || !rule.message.trim()) {
    return `Rule at index ${index} ("${rule.category}") has missing or empty message.`;
  }
  if (!(rule.pattern instanceof RegExp)) {
    // Try to compile from string if given as a string
    if (typeof rule.pattern === "string") {
      try {
        new RegExp(rule.pattern, "i");
      } catch (e) {
        return `Rule at index ${index} ("${rule.category}") has invalid regex pattern: ${e.message}`;
      }
    } else {
      return `Rule at index ${index} ("${rule.category}") has no pattern (expected RegExp or regex string).`;
    }
  }
  return true;
}

/**
 * Compile a custom rule: if pattern is a string, convert to RegExp.
 */
function compileRule(rule) {
  const compiled = { ...rule };
  if (typeof compiled.pattern === "string") {
    compiled.pattern = new RegExp(compiled.pattern, "i");
  }
  return compiled;
}

/**
 * Scan text for all risk patterns and URL risks.
 * Options:
 *   - customRules: Array of { severity, category, pattern, message } rules to merge
 *   - threshold: Minimum severity to include in flags (default: 0, include all)
 * Returns { safe, level, score, flags }.
 */
function scanText(text, options = {}) {
  const value = String(text || "");
  const flags = [];

  // Built-in rules
  for (const rule of RISK_PATTERNS) {
    if (rule.pattern.test(value)) {
      flags.push({
        severity: rule.severity,
        category: rule.category,
        message: rule.message,
        source: "builtin"
      });
    }
  }

  // Custom rules (if provided)
  if (Array.isArray(options.customRules)) {
    for (let i = 0; i < options.customRules.length; i++) {
      const rule = compileRule(options.customRules[i]);
      if (rule.pattern.test(value)) {
        flags.push({
          severity: rule.severity,
          category: rule.category,
          message: rule.message,
          source: "custom"
        });
      }
    }
  }

  // URL scanning
  for (const url of extractUrls(value)) {
    flags.push(...scanUrl(url));
  }

  // Filter by threshold if provided
  const threshold = typeof options.threshold === "number" ? options.threshold : 0;
  const filtered = threshold > 0 ? flags.filter((f) => f.severity >= threshold) : flags;

  const score = flags.reduce((max, f) => Math.max(max, f.severity), 0);
  return {
    safe: score < 70,
    level: riskLevel(score),
    score,
    flags: filtered
  };
}

/**
 * Scan a GitHub issue/PR event payload.
 * Accepts { title, body, user, labels, comments[] }.
 * Options are passed through to scanText.
 * Returns { safe, level, score, flags, parts }.
 */
function scanEvent(event = {}, options = {}) {
  const parts = {};

  if (event.title) parts.title = scanText(event.title, options);
  if (event.body) parts.body = scanText(event.body, options);

  if (Array.isArray(event.comments)) {
    parts.comments = event.comments.map((c, i) => ({
      index: i,
      user: c.user || null,
      ...(c.body ? scanText(c.body, options) : { safe: true, level: "clear", score: 0, flags: [] })
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
  riskLevel,
  validateCustomRule,
  compileRule
};
