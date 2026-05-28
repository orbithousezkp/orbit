"use strict";

// F-1.4 (PLAN/ROADMAP_EXPANSION.md): AI provider canary predicate.
//
// Reads the T-8 performance-based routing state (ai-routing.js) and reports
// which providers should get a tiny canary ping THIS cycle to detect silent
// degradation before the next real call. This module is the pure predicate;
// the actual ping (one small chat-completion request) is wired by the cycle.
//
// Status values:
//   - healthy:  recent success, low rolling failures, not silent.
//   - silent:   no success in CANARY_SILENT_AFTER_MS — could be alive or dead.
//   - degraded: rollingFailures ≥ threshold but not yet demoted (warning).
//   - demoted:  routing has demoteUntil in the future — already routed around.
//   - unknown:  no routing record for this provider name (first seen).
//
// canaryDue = true for everything except healthy + demoted (already-skipped
// or already-known-good).

const HOUR_MS = 60 * 60 * 1000;
const CANARY_SILENT_AFTER_MS = 6 * HOUR_MS;
const CANARY_DEGRADED_FAILURE_THRESHOLD = 2;

function isDemoted(provider, nowMs) {
  if (!provider || !provider.demoteUntil) return false;
  const until = Date.parse(provider.demoteUntil);
  return Number.isFinite(until) && until > nowMs;
}

function evaluateCanaryHealth(routing, providerNames, options = {}) {
  if (!routing || !Array.isArray(providerNames)) {
    return { providers: [], canaryDue: [] };
  }
  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  const silentAfterMs = options.silentAfterMs != null
    ? Number(options.silentAfterMs)
    : CANARY_SILENT_AFTER_MS;
  const degradedThreshold = options.degradedThreshold != null
    ? Number(options.degradedThreshold)
    : CANARY_DEGRADED_FAILURE_THRESHOLD;

  const routingProviders = (routing.providers && typeof routing.providers === "object")
    ? routing.providers
    : {};

  const results = providerNames.map((name) => {
    const p = routingProviders[name];
    if (!p) {
      return { name, status: "unknown", canaryDue: true };
    }
    if (isDemoted(p, nowMs)) {
      return {
        name,
        status: "demoted",
        canaryDue: false,
        demoteUntil: p.demoteUntil
      };
    }
    const rolling = Number(p.rollingFailures || 0);
    if (rolling >= degradedThreshold) {
      return {
        name,
        status: "degraded",
        canaryDue: true,
        rollingFailures: rolling
      };
    }
    const lastSuccessMs = p.lastSuccessAt ? Date.parse(p.lastSuccessAt) : NaN;
    if (Number.isNaN(lastSuccessMs)) {
      return { name, status: "silent", canaryDue: true, lastSuccessAt: null };
    }
    const ageMs = nowMs - lastSuccessMs;
    if (ageMs > silentAfterMs) {
      return {
        name,
        status: "silent",
        canaryDue: true,
        lastSuccessAt: p.lastSuccessAt,
        ageMs
      };
    }
    return {
      name,
      status: "healthy",
      canaryDue: false,
      lastSuccessAt: p.lastSuccessAt,
      ageMs
    };
  });

  return {
    providers: results,
    canaryDue: results.filter((r) => r.canaryDue).map((r) => r.name)
  };
}

module.exports = {
  CANARY_SILENT_AFTER_MS,
  CANARY_DEGRADED_FAILURE_THRESHOLD,
  evaluateCanaryHealth
};
