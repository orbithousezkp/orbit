"use strict";

const {
  buildReport,
  scanText,
  scanEvent,
  formatSummary,
  extractUrls,
  domainOf,
  scanUrl,
  recommendedAction,
  riskLevel,
  validateCustomRule,
  compileRule
} = require("./scan");
const { RISK_PATTERNS, SHORTENER_DOMAINS, SAFE_DOMAINS } = require("./rules");

module.exports = {
  // Scanning
  scanText,
  scanEvent,
  scanUrl,
  buildReport,

  // Formatting
  formatSummary,
  recommendedAction,
  riskLevel,

  // Utilities
  extractUrls,
  domainOf,
  validateCustomRule,
  compileRule,

  // Rule data
  RISK_PATTERNS,
  SHORTENER_DOMAINS,
  SAFE_DOMAINS
};
