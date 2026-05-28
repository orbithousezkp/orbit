"use strict";

// F-2.3 (PLAN/ROADMAP_EXPANSION.md): per-provider cost ceiling +
// auto-failover. Caps $/cycle/provider so a runaway prompt cannot drain
// the daily AI budget on one provider before hitting the global cap.
//
// Pairs with:
//   - F-1.4 ai-canary.js (degraded-provider detection)
//   - T-8 ai-routing.js (priority ordering)
//
// Caller flow:
//   1. ledger = initCostLedger(providers)              // per-cycle start
//   2. ok = checkProviderCeiling(ledger, p, {projectedUsd})
//   3. if not ok: failover = pickFailoverProvider(ledger, priority)
//   4. after call: ledger = recordProviderCost(ledger, p, actualUsd)
//
// Pure: never mutates input ledger.

const DEFAULT_PER_PROVIDER_CEILING_USD = 1.00; // $1/provider/cycle

function initCostLedger(providers, options = {}) {
  const list = Array.isArray(providers) ? providers : [];
  const ceilings = (options && options.ceilings) || {};
  const out = { providers: {} };
  for (const name of list) {
    const ceiling = Number.isFinite(ceilings[name]) && ceilings[name] >= 0
      ? ceilings[name]
      : DEFAULT_PER_PROVIDER_CEILING_USD;
    out.providers[name] = {
      totalUsd: 0,
      callCount: 0,
      ceilingUsd: ceiling
    };
  }
  return out;
}

function recordProviderCost(ledger, provider, costUsd) {
  if (!ledger || !ledger.providers || !ledger.providers[provider]) return ledger;
  const cost = Number(costUsd);
  if (!Number.isFinite(cost) || cost <= 0) {
    return { providers: { ...ledger.providers } };
  }
  const current = ledger.providers[provider];
  const next = {
    ...ledger,
    providers: {
      ...ledger.providers,
      [provider]: {
        ...current,
        totalUsd: current.totalUsd + cost,
        callCount: (current.callCount || 0) + 1
      }
    }
  };
  return next;
}

function checkProviderCeiling(ledger, provider, options = {}) {
  if (!ledger || !ledger.providers) {
    return { ok: false, kind: "bad_ledger" };
  }
  const p = ledger.providers[provider];
  if (!p) {
    return { ok: false, kind: "unknown_provider", provider };
  }
  const totalUsd = p.totalUsd || 0;
  const ceilingUsd = p.ceilingUsd != null ? p.ceilingUsd : DEFAULT_PER_PROVIDER_CEILING_USD;
  const remainingUsd = Math.max(0, ceilingUsd - totalUsd);
  if (remainingUsd === 0) {
    return {
      ok: false,
      kind: "exhausted",
      provider,
      totalUsd,
      ceilingUsd,
      remainingUsd: 0
    };
  }
  const projectedUsd = Number.isFinite(options.projectedUsd) ? Number(options.projectedUsd) : 0;
  if (projectedUsd > remainingUsd) {
    return {
      ok: false,
      kind: "would_exceed",
      provider,
      totalUsd,
      ceilingUsd,
      remainingUsd,
      projectedUsd
    };
  }
  return { ok: true, provider, totalUsd, ceilingUsd, remainingUsd };
}

function pickFailoverProvider(ledger, priority) {
  if (!Array.isArray(priority) || priority.length === 0) {
    return { ok: false, kind: "no_priority_list", skipped: [] };
  }
  const skipped = [];
  for (const provider of priority) {
    const check = checkProviderCeiling(ledger, provider);
    if (check.ok) {
      return { ok: true, provider, skipped };
    }
    skipped.push({ provider, reason: check.kind });
  }
  return { ok: false, kind: "all_exhausted", skipped };
}

function costSnapshot(ledger) {
  if (!ledger || !ledger.providers) return [];
  return Object.keys(ledger.providers).map((provider) => {
    const p = ledger.providers[provider];
    const ceilingUsd = p.ceilingUsd != null ? p.ceilingUsd : DEFAULT_PER_PROVIDER_CEILING_USD;
    const totalUsd = p.totalUsd || 0;
    const remainingUsd = Math.max(0, ceilingUsd - totalUsd);
    return {
      provider,
      totalUsd,
      ceilingUsd,
      remainingUsd,
      exhausted: remainingUsd === 0,
      callCount: p.callCount || 0
    };
  });
}

module.exports = {
  DEFAULT_PER_PROVIDER_CEILING_USD,
  checkProviderCeiling,
  costSnapshot,
  initCostLedger,
  pickFailoverProvider,
  recordProviderCost
};
