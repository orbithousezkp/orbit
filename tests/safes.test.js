"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SAFE_DEFINITIONS,
  addressOf,
  isValidSafeAddress,
  loadSafes,
  requireAllSafes
} = require("../src/agent/safes");

const VALID = {
  ORBIT_TREASURY_SAFE:         "0xFEE0000000000000000000000000000000000FEE",
  ORBIT_FLOOR_RESERVE_SAFE:    "0xF1001110000000000000000000000000000000F1",
  ORBIT_PRODUCTIVE_YIELD_SAFE: "0xF2002220000000000000000000000000000000F2",
  ORBIT_BUYBACK_SAFE:          "0xF3003330000000000000000000000000000000F3",
  ORBIT_GROWTH_SAFE:           "0xF4004440000000000000000000000000000000F4",
  ORBIT_AI_COSTS_SAFE:         "0xF5005550000000000000000000000000000000F5",
  ORBIT_OPS_RUNWAY_SAFE:       "0xF6006660000000000000000000000000000000F6"
};

test("SAFE_DEFINITIONS lists the 7 D-019 Safes with correct env names", () => {
  assert.equal(SAFE_DEFINITIONS.length, 7);
  const ids = SAFE_DEFINITIONS.map((d) => d.id);
  assert.deepEqual(ids, [
    "fee-receive",
    "floor-reserve",
    "productive-yield",
    "buyback",
    "growth",
    "ai-costs",
    "ops-runway"
  ]);
  assert.equal(SAFE_DEFINITIONS[0].env, "ORBIT_TREASURY_SAFE");
  assert.equal(SAFE_DEFINITIONS[3].env, "ORBIT_BUYBACK_SAFE");
});

test("SAFE_DEFINITIONS group into expected categories", () => {
  const byCat = {};
  for (const def of SAFE_DEFINITIONS) {
    const cat = def.category || "fee-receive";
    byCat[cat] = (byCat[cat] || 0) + 1;
  }
  assert.equal(byCat["treasury"], 2);
  assert.equal(byCat["business"], 2);
  assert.equal(byCat["operations"], 2);
  assert.equal(byCat["fee-receive"], 1);
});

test("isValidSafeAddress accepts well-formed EVM addresses", () => {
  assert.equal(isValidSafeAddress("0xFEE0000000000000000000000000000000000FEE"), true);
  // EIP-55 mixed-case (properly checksummed)
  assert.equal(isValidSafeAddress("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"), true);
  // All-lowercase: accepted as uncheck­summed per EIP-55
  assert.equal(isValidSafeAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359"), true);
  // All-uppercase: accepted as uncheck­summed per EIP-55
  assert.equal(isValidSafeAddress("0xFB6916095CA1DF60BB79CE92CE3EA74C37C5D359"), true);
});

test("isValidSafeAddress rejects mixed-case addresses that fail EIP-55", () => {
  // First letter case flipped from the valid vector above.
  assert.equal(isValidSafeAddress("0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"), false);
  // Last letter case flipped from the valid vector above.
  assert.equal(isValidSafeAddress("0xfB6916095ca1df60bB79CE92cE3Ea74c37c5d359"), false);
});

test("isValidSafeAddress rejects malformed, empty, and non-hex values", () => {
  assert.equal(isValidSafeAddress(""), false);
  assert.equal(isValidSafeAddress(null), false);
  assert.equal(isValidSafeAddress(undefined), false);
  assert.equal(isValidSafeAddress("0xnothex"), false);
  assert.equal(isValidSafeAddress("FEE0000000000000000000000000000000000FEE"), false); // missing 0x
  assert.equal(isValidSafeAddress("0xFEE0"), false); // too short
});

test("loadSafes returns ok=true with all 7 Safes when env is fully configured", () => {
  const result = loadSafes(VALID);
  assert.equal(result.ok, true);
  assert.equal(result.safes.length, 7);
  assert.equal(result.missing.length, 0);
  assert.equal(result.conflicts.length, 0);
  for (const s of result.safes) {
    assert.equal(s.valid, true, `${s.id} should be valid`);
    assert.equal(s.address, VALID[s.env]);
  }
});

test("loadSafes flags a single missing Safe", () => {
  const env = { ...VALID };
  delete env.ORBIT_AI_COSTS_SAFE;
  const result = loadSafes(env);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["ai-costs"]);
  const aiCosts = result.safes.find((s) => s.id === "ai-costs");
  assert.equal(aiCosts.valid, false);
  assert.equal(aiCosts.reason, "missing");
  assert.equal(aiCosts.address, null);
});

test("loadSafes flags multiple missing Safes", () => {
  const env = { ...VALID };
  delete env.ORBIT_BUYBACK_SAFE;
  delete env.ORBIT_GROWTH_SAFE;
  delete env.ORBIT_OPS_RUNWAY_SAFE;
  const result = loadSafes(env);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing.sort(), ["buyback", "growth", "ops-runway"]);
});

test("loadSafes flags invalid (malformed) address", () => {
  const env = { ...VALID, ORBIT_BUYBACK_SAFE: "0xnotanaddress" };
  const result = loadSafes(env);
  assert.equal(result.ok, false);
  const buyback = result.safes.find((s) => s.id === "buyback");
  assert.equal(buyback.valid, false);
  assert.equal(buyback.reason, "invalid");
  assert.equal(buyback.address, "0xnotanaddress");
});

test("loadSafes treats empty string as missing, not invalid", () => {
  const env = { ...VALID, ORBIT_FLOOR_RESERVE_SAFE: "   " };
  const result = loadSafes(env);
  assert.equal(result.ok, false);
  const fr = result.safes.find((s) => s.id === "floor-reserve");
  assert.equal(fr.valid, false);
  assert.equal(fr.reason, "missing");
  assert.deepEqual(result.missing, ["floor-reserve"]);
});

test("loadSafes detects duplicate addresses across Safes", () => {
  const shared = "0xDEAD000000000000000000000000000000000000";
  const env = { ...VALID, ORBIT_BUYBACK_SAFE: shared, ORBIT_GROWTH_SAFE: shared };
  const result = loadSafes(env);
  assert.equal(result.ok, false);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].address.toLowerCase(), shared.toLowerCase());
  assert.deepEqual(result.conflicts[0].ids.sort(), ["buyback", "growth"]);
  // Each conflicted Safe entry is marked invalid with reason=duplicate.
  for (const id of ["buyback", "growth"]) {
    const safe = result.safes.find((s) => s.id === id);
    assert.equal(safe.valid, false);
    assert.equal(safe.reason, "duplicate");
  }
});

test("loadSafes with empty env returns 7 missing", () => {
  const result = loadSafes({});
  assert.equal(result.ok, false);
  assert.equal(result.missing.length, 7);
  for (const s of result.safes) assert.equal(s.valid, false);
});

test("loadSafes accepts undefined env without throwing", () => {
  const result = loadSafes(undefined);
  assert.equal(result.ok, false);
  assert.equal(result.missing.length, 7);
});

test("requireAllSafes returns the safes array when all valid", () => {
  const safes = requireAllSafes(VALID);
  assert.equal(safes.length, 7);
  assert.equal(safes[0].id, "fee-receive");
});

test("requireAllSafes throws on any missing Safe", () => {
  const env = { ...VALID };
  delete env.ORBIT_TREASURY_SAFE;
  assert.throws(() => requireAllSafes(env), /Safe configuration invalid/);
  assert.throws(() => requireAllSafes(env), /missing: fee-receive/);
});

test("requireAllSafes throws on invalid address with detail", () => {
  const env = { ...VALID, ORBIT_OPS_RUNWAY_SAFE: "0xZZZ" };
  assert.throws(() => requireAllSafes(env), /invalid: ops-runway/);
});

test("requireAllSafes throws on duplicate addresses", () => {
  const env = { ...VALID, ORBIT_BUYBACK_SAFE: VALID.ORBIT_GROWTH_SAFE };
  assert.throws(() => requireAllSafes(env), /duplicate addresses/);
});

test("addressOf returns the address for a known id", () => {
  assert.equal(addressOf(VALID, "buyback"), VALID.ORBIT_BUYBACK_SAFE);
  assert.equal(addressOf(VALID, "fee-receive"), VALID.ORBIT_TREASURY_SAFE);
  assert.equal(addressOf(VALID, "ai-costs"), VALID.ORBIT_AI_COSTS_SAFE);
});

test("addressOf returns null for an unknown id", () => {
  assert.equal(addressOf(VALID, "not-a-safe"), null);
  assert.equal(addressOf(VALID, ""), null);
});

test("addressOf returns null when env value is missing or invalid", () => {
  assert.equal(addressOf({}, "buyback"), null);
  assert.equal(addressOf({ ORBIT_BUYBACK_SAFE: "" }, "buyback"), null);
  assert.equal(addressOf({ ORBIT_BUYBACK_SAFE: "0xnothex" }, "buyback"), null);
});

// --- EIP-55 checksum enforcement (Bug fix: silent fund loss on typo) -------
//
// Before this fix, isValidSafeAddress only checked the hex-shape regex, so a
// typo with valid hex chars (e.g., swapping `b` for `6`) would pass preflight
// and the weekly treasury sweep would send inflow to an address nobody owns.
// loadSafes now distinguishes "invalid" (wrong shape) from "bad_checksum"
// (mixed-case fails EIP-55) so the operator gets a clear diagnostic.

test("loadSafes flags mixed-case bad EIP-55 checksum with reason=bad_checksum", () => {
  // First letter case flipped from the canonical EIP-55 vector.
  const env = { ...VALID, ORBIT_BUYBACK_SAFE: "0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359" };
  const result = loadSafes(env);
  assert.equal(result.ok, false);
  const buyback = result.safes.find((s) => s.id === "buyback");
  assert.equal(buyback.valid, false);
  assert.equal(buyback.reason, "bad_checksum");
  assert.equal(buyback.address, "0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359");
});

test("loadSafes accepts a mixed-case address with a valid EIP-55 checksum", () => {
  const env = { ...VALID, ORBIT_BUYBACK_SAFE: "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359" };
  const result = loadSafes(env);
  assert.equal(result.ok, true);
  const buyback = result.safes.find((s) => s.id === "buyback");
  assert.equal(buyback.valid, true);
  assert.equal(buyback.address, "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359");
});

test("loadSafes accepts an all-lowercase address (uncheck­summed per EIP-55)", () => {
  const env = { ...VALID, ORBIT_GROWTH_SAFE: "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359" };
  const result = loadSafes(env);
  assert.equal(result.ok, true);
  const growth = result.safes.find((s) => s.id === "growth");
  assert.equal(growth.valid, true);
});

test("loadSafes accepts an all-uppercase address (uncheck­summed per EIP-55)", () => {
  const env = { ...VALID, ORBIT_OPS_RUNWAY_SAFE: "0xFB6916095CA1DF60BB79CE92CE3EA74C37C5D359" };
  const result = loadSafes(env);
  assert.equal(result.ok, true);
  const ops = result.safes.find((s) => s.id === "ops-runway");
  assert.equal(ops.valid, true);
});

test("loadSafes flags the additional EIP-55 mismatch vector with bad_checksum", () => {
  // 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d35a is the canonical valid
  // address with its last char nibble flipped to `a` — a different address
  // whose checksum case pattern no longer matches.
  const env = { ...VALID, ORBIT_FLOOR_RESERVE_SAFE: "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d35a" };
  const result = loadSafes(env);
  assert.equal(result.ok, false);
  const fr = result.safes.find((s) => s.id === "floor-reserve");
  assert.equal(fr.valid, false);
  assert.equal(fr.reason, "bad_checksum");
});

test("requireAllSafes surfaces bad_checksum in its error message", () => {
  const env = { ...VALID, ORBIT_BUYBACK_SAFE: "0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359" };
  assert.throws(() => requireAllSafes(env), /bad checksum \(EIP-55\): buyback/);
});

test("addressOf returns null for a mixed-case bad EIP-55 checksum", () => {
  const env = { ORBIT_BUYBACK_SAFE: "0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359" };
  assert.equal(addressOf(env, "buyback"), null);
});

test("addressOf returns the address for a valid EIP-55 mixed-case input", () => {
  const env = { ORBIT_BUYBACK_SAFE: "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359" };
  assert.equal(addressOf(env, "buyback"), "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359");
});

test("EIP-55 extra valid vectors are accepted", () => {
  assert.equal(isValidSafeAddress("0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB"), true);
  assert.equal(isValidSafeAddress("0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"), true);
});
