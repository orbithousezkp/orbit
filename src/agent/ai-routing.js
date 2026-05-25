"use strict";

// Performance-based AI provider routing (T-8).
//
// Replaces the static priority order in inference.js with a weighted shuffle
// that auto-demotes on consecutive failures and auto-promotes after a clean
// stretch. All state lives in `state.aiRouting` (persisted across cycles via
// memory/state.json).
//
// Threshold defaults match PLAN/STABILITY_SECURITY.md §2 (T-8):
//  - 3 consecutive failures => demote (weight = 0) for 1 hour
//  - 24-hour clean stretch  => promote (weight += 0.25, capped at 1.0)
//  - rolling-window stats   => 7 days

const DEFAULT_WEIGHT = 1.0;
const MIN_WEIGHT = 0.0;
const MAX_WEIGHT = 1.0;
const PROMOTION_STEP = 0.25;
const FAILURE_THRESHOLD = 3;
const DEMOTION_DURATION_MS = 60 * 60 * 1000;
const PROMOTION_CLEAN_STRETCH_MS = 24 * 60 * 60 * 1000;

function ensureProvider(routing, name) {
  if (!routing.providers) routing.providers = {};
  if (!routing.providers[name]) {
    routing.providers[name] = {
      successCount: 0,
      failureCount: 0,
      rollingFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      avgLatencyMs: null,
      weight: DEFAULT_WEIGHT,
      demoteUntil: null
    };
  }
  return routing.providers[name];
}

function isDemoted(provider, now) {
  if (!provider || !provider.demoteUntil) return false;
  const until = Date.parse(provider.demoteUntil);
  return Number.isFinite(until) && until > now;
}

function effectiveWeight(provider, now) {
  if (!provider) return DEFAULT_WEIGHT;
  if (isDemoted(provider, now)) return 0;
  const w = typeof provider.weight === "number" ? provider.weight : DEFAULT_WEIGHT;
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, w));
}

function orderProviders(routing, providers, now = Date.now(), randomFn = Math.random) {
  if (!Array.isArray(providers) || providers.length === 0) return [];
  const r = routing || {};
  const tracked = r.providers && Object.keys(r.providers).length > 0;
  // When no routing state exists (first run after deploy), preserve the
  // operator's insertion order — this is the deterministic baseline.
  if (!tracked) return [...providers];

  const annotated = providers.map((provider, index) => {
    const stats = r.providers && r.providers[provider.name];
    const w = effectiveWeight(stats, now);
    const jitter = stats ? (randomFn() - 0.5) * 0.05 : 0;
    return { provider, index, weight: w + jitter };
  });
  annotated.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.index - b.index;
  });
  return annotated.map((entry) => entry.provider);
}

function recordSuccess(routing, name, { latencyMs } = {}, now = Date.now()) {
  if (!routing.providers) routing.providers = {};
  const p = ensureProvider(routing, name);
  p.successCount = (p.successCount || 0) + 1;
  p.rollingFailures = 0;
  p.lastSuccessAt = new Date(now).toISOString();
  if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
    p.avgLatencyMs = p.avgLatencyMs
      ? Math.round(p.avgLatencyMs * 0.8 + latencyMs * 0.2)
      : Math.round(latencyMs);
  }
  if (p.demoteUntil && Date.parse(p.demoteUntil) <= now) {
    p.demoteUntil = null;
  }
  if (p.weight < MAX_WEIGHT) {
    const lastFailMs = p.lastFailureAt ? Date.parse(p.lastFailureAt) : null;
    const cleanStretch =
      !lastFailMs ||
      !Number.isFinite(lastFailMs) ||
      now - lastFailMs > PROMOTION_CLEAN_STRETCH_MS;
    if (cleanStretch) {
      p.weight = Math.min(MAX_WEIGHT, p.weight + PROMOTION_STEP);
    }
  }
  return p;
}

function recordFailure(routing, name, { reason } = {}, now = Date.now()) {
  if (!routing.providers) routing.providers = {};
  const p = ensureProvider(routing, name);
  p.failureCount = (p.failureCount || 0) + 1;
  p.rollingFailures = (p.rollingFailures || 0) + 1;
  p.lastFailureAt = new Date(now).toISOString();
  p.lastFailureReason = reason || null;
  if (p.rollingFailures >= FAILURE_THRESHOLD) {
    p.demoteUntil = new Date(now + DEMOTION_DURATION_MS).toISOString();
    p.weight = MIN_WEIGHT;
  }
  return p;
}

function routingSnapshot(routing) {
  if (!routing || !routing.providers) return { providers: {} };
  const out = {};
  for (const [name, p] of Object.entries(routing.providers)) {
    out[name] = {
      weight: p.weight,
      demoteUntil: p.demoteUntil || null,
      rollingFailures: p.rollingFailures || 0,
      successCount: p.successCount || 0,
      failureCount: p.failureCount || 0,
      avgLatencyMs: p.avgLatencyMs || null,
      lastSuccessAt: p.lastSuccessAt || null,
      lastFailureAt: p.lastFailureAt || null
    };
  }
  return { providers: out };
}

module.exports = {
  DEFAULT_WEIGHT,
  FAILURE_THRESHOLD,
  DEMOTION_DURATION_MS,
  PROMOTION_CLEAN_STRETCH_MS,
  PROMOTION_STEP,
  ensureProvider,
  isDemoted,
  effectiveWeight,
  orderProviders,
  recordSuccess,
  recordFailure,
  routingSnapshot
};
