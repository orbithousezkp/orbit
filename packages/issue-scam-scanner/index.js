"use strict";

const { scanText, scanEvent, formatSummary, extractUrls, domainOf, scanUrl, riskLevel } = require("./scan");
const { RISK_PATTERNS, SHORTENER_DOMAINS, SAFE_DOMAINS } = require("./rules");

module.exports = {
  // Scanning
  scanText,
  scanEvent,
  scanUrl,

  // Formatting
  formatSummary,
  riskLevel,

  // Utilities
  extractUrls,
  domainOf,

  // Rule data
  RISK_PATTERNS,
  SHORTENER_DOMAINS,
  SAFE_DOMAINS
};
