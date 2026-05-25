"use strict";

const crypto = require("crypto");

const FLOOR_MS = 20 * 60 * 1000;
const TARGET_MIN_MS = 30 * 60 * 1000;
const TARGET_MAX_MS = 90 * 60 * 1000;
const DEV_HMAC_KEY = "ORBIT_SKIP_GUARD_DEV_KEY";

function hmacKey(config) {
  return (config && config.walletPrivateKey) || DEV_HMAC_KEY;
}

function sign(config, lastCycleAt, nextCycleTargetAt) {
  return crypto
    .createHmac("sha256", hmacKey(config))
    .update(`${lastCycleAt}|${nextCycleTargetAt}`)
    .digest("hex");
}

function verify(config, lastCycleAt, nextCycleTargetAt, providedSig) {
  if (!lastCycleAt || !nextCycleTargetAt || !providedSig) return false;
  if (typeof providedSig !== "string") return false;
  const expected = sign(config, lastCycleAt, nextCycleTargetAt);
  if (expected.length !== providedSig.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(providedSig, "hex")
    );
  } catch {
    return false;
  }
}

function drawNextTarget(config, lastCycleAt, randomFn = Math.random) {
  const lastMs = Date.parse(lastCycleAt);
  if (!Number.isFinite(lastMs)) {
    throw new Error("drawNextTarget: invalid lastCycleAt");
  }
  const range = TARGET_MAX_MS - TARGET_MIN_MS;
  const gapMs = TARGET_MIN_MS + Math.floor(randomFn() * range);
  const nextCycleTargetAt = new Date(lastMs + gapMs).toISOString();
  const skipGuardSig = sign(config, lastCycleAt, nextCycleTargetAt);
  return { lastCycleAt, nextCycleTargetAt, skipGuardSig, gapMs };
}

function evaluateSkip(config, state, now = Date.now()) {
  const trigger = config && config.cycleTrigger;
  if (trigger !== "schedule") {
    return { skip: false, reason: "trigger_bypass", trigger: trigger || "unknown" };
  }

  const lastIso = state && state.lastCycleAt;
  if (!lastIso) return { skip: false, reason: "no_prior_cycle" };

  const lastMs = Date.parse(lastIso);
  if (!Number.isFinite(lastMs)) return { skip: false, reason: "invalid_prior_cycle" };

  const elapsedMs = now - lastMs;

  if (elapsedMs < FLOOR_MS) {
    return {
      skip: true,
      reason: "floor",
      lastCycleAt: lastIso,
      elapsedMs,
      floorMs: FLOOR_MS
    };
  }

  const targetIso = state.nextCycleTargetAt;
  const sig = state.skipGuardSig;
  if (targetIso && sig) {
    if (!verify(config, lastIso, targetIso, sig)) {
      return { skip: false, reason: "bad_signature", lastCycleAt: lastIso };
    }
    const targetMs = Date.parse(targetIso);
    if (Number.isFinite(targetMs) && now < targetMs) {
      return {
        skip: true,
        reason: "target",
        lastCycleAt: lastIso,
        nextCycleTargetAt: targetIso,
        elapsedMs,
        remainingMs: targetMs - now
      };
    }
  }

  return { skip: false, reason: "ok", lastCycleAt: lastIso, elapsedMs };
}

module.exports = {
  FLOOR_MS,
  TARGET_MIN_MS,
  TARGET_MAX_MS,
  drawNextTarget,
  evaluateSkip,
  sign,
  verify
};
