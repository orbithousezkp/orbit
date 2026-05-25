"use strict";

// Centralized Safe address validation (D-019 / S-LAUNCH-1).
//
// Single source of truth for the 7 Treasury Safe addresses defined in the
// D-019 treasury topology. Every module that needs a Safe address must read
// it from here so we keep validation consistent and prevent silent
// misconfiguration (e.g., the same address pasted into two env vars).
//
// Spec:     PLAN/SPECS/TREASURY_ALLOCATION.md
// Decision: PLAN/DECISIONS.md D-019

const { isAddress, isStrictAddress } = require("./addresses");

const SAFE_DEFINITIONS = [
  { id: "fee-receive",      env: "ORBIT_TREASURY_SAFE",         category: null,         purpose: "Clanker fee payout transit" },
  { id: "floor-reserve",    env: "ORBIT_FLOOR_RESERVE_SAFE",    category: "treasury",   purpose: "Price-floor anchor" },
  { id: "productive-yield", env: "ORBIT_PRODUCTIVE_YIELD_SAFE", category: "treasury",   purpose: "Aave/Uniswap deployment" },
  { id: "buyback",          env: "ORBIT_BUYBACK_SAFE",          category: "business",   purpose: "Weekly $ORBIT buyback" },
  { id: "growth",           env: "ORBIT_GROWTH_SAFE",           category: "business",   purpose: "Mission rewards + adopter + bounty match" },
  { id: "ai-costs",         env: "ORBIT_AI_COSTS_SAFE",         category: "operations", purpose: "AI invoice reimbursement" },
  { id: "ops-runway",       env: "ORBIT_OPS_RUNWAY_SAFE",       category: "operations", purpose: "Gas + RPC + infra" }
];

// Validates a Safe address with shape + EIP-55 checksum enforcement.
// A mixed-case address that fails the EIP-55 checksum is rejected so a
// single-character typo (e.g., swapping `b` for `6`) cannot pass preflight
// and silently route weekly treasury sweeps to an address nobody controls.
// All-lowercase and all-uppercase addresses are accepted (EIP-55 permissive).
function isValidSafeAddress(address) {
  if (address === null || address === undefined) return false;
  const str = String(address).trim();
  if (str === "") return false;
  return isStrictAddress(str);
}

function definitionFor(id) {
  return SAFE_DEFINITIONS.find((def) => def.id === id) || null;
}

function loadSafes(env) {
  const e = env || {};
  const safes = [];
  const missing = [];
  const seenAddresses = new Map(); // lowercased-address -> [ids]

  for (const def of SAFE_DEFINITIONS) {
    const raw = e[def.env];
    const present = raw !== null && raw !== undefined && String(raw).trim() !== "";
    if (!present) {
      safes.push({
        id: def.id,
        env: def.env,
        category: def.category,
        purpose: def.purpose,
        address: null,
        valid: false,
        reason: "missing"
      });
      missing.push(def.id);
      continue;
    }
    const address = String(raw).trim();
    const shapeOk = isAddress(address);
    const checksumOk = shapeOk && isStrictAddress(address);
    if (!shapeOk || !checksumOk) {
      // "invalid" = wrong shape (not 0x + 40 hex chars).
      // "bad_checksum" = right shape, but mixed-case fails EIP-55 — strong
      // signal of a typo. Both surface as valid:false to callers that only
      // care that the address is unusable.
      safes.push({
        id: def.id,
        env: def.env,
        category: def.category,
        purpose: def.purpose,
        address,
        valid: false,
        reason: shapeOk ? "bad_checksum" : "invalid"
      });
      continue;
    }
    safes.push({
      id: def.id,
      env: def.env,
      category: def.category,
      purpose: def.purpose,
      address,
      valid: true
    });
    const key = address.toLowerCase();
    if (!seenAddresses.has(key)) seenAddresses.set(key, []);
    seenAddresses.get(key).push(def.id);
  }

  const conflicts = [];
  for (const [address, ids] of seenAddresses.entries()) {
    if (ids.length > 1) {
      conflicts.push({ address, ids: [...ids] });
    }
  }

  // If a Safe entry participates in a conflict, mark it invalid and surface
  // the reason. Keeps callers from accidentally treating a duplicate as ok.
  if (conflicts.length > 0) {
    const conflictIds = new Set();
    for (const c of conflicts) {
      for (const id of c.ids) conflictIds.add(id);
    }
    for (const safe of safes) {
      if (conflictIds.has(safe.id) && safe.valid) {
        safe.valid = false;
        safe.reason = "duplicate";
      }
    }
  }

  const ok = missing.length === 0
    && conflicts.length === 0
    && safes.every((s) => s.valid);

  return { ok, safes, missing, conflicts };
}

function requireAllSafes(env) {
  const result = loadSafes(env);
  if (result.ok) return result.safes;
  const reasons = [];
  if (result.missing.length > 0) {
    reasons.push(`missing: ${result.missing.join(", ")}`);
  }
  const invalid = result.safes.filter((s) => !s.valid && s.reason === "invalid").map((s) => s.id);
  if (invalid.length > 0) {
    reasons.push(`invalid: ${invalid.join(", ")}`);
  }
  const badChecksum = result.safes.filter((s) => !s.valid && s.reason === "bad_checksum").map((s) => s.id);
  if (badChecksum.length > 0) {
    reasons.push(`bad checksum (EIP-55): ${badChecksum.join(", ")}`);
  }
  if (result.conflicts.length > 0) {
    const parts = result.conflicts.map((c) => `${c.address} -> [${c.ids.join(", ")}]`);
    reasons.push(`duplicate addresses: ${parts.join("; ")}`);
  }
  throw new Error(`Safe configuration invalid (D-019): ${reasons.join("; ")}`);
}

function addressOf(env, id) {
  const def = definitionFor(id);
  if (!def) return null;
  const raw = env && env[def.env];
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str === "") return null;
  if (!isStrictAddress(str)) return null;
  return str;
}

module.exports = {
  SAFE_DEFINITIONS,
  addressOf,
  isValidSafeAddress,
  loadSafes,
  requireAllSafes
};
