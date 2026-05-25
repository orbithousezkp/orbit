"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isAddress,
  isChecksumAddress,
  isStrictAddress
} = require("../src/agent/addresses");

// Canonical EIP-55 test vector. The mixed-case form is the only one that
// could possibly catch a typo; the all-lowercase and all-uppercase forms
// are accepted as "uncheck­summed" per the EIP.
const CANONICAL = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";

test("isAddress is shape-only and accepts mixed case", () => {
  assert.equal(isAddress(CANONICAL), true);
  assert.equal(isAddress(CANONICAL.toLowerCase()), true);
  assert.equal(isAddress(CANONICAL.toUpperCase().replace("0X", "0x")), true);
  // A typo with a flipped letter case is still a valid hex shape — that is
  // exactly the gap isChecksumAddress closes.
  assert.equal(isAddress("0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"), true);
});

test("isAddress rejects non-shape inputs", () => {
  assert.equal(isAddress(""), false);
  assert.equal(isAddress(null), false);
  assert.equal(isAddress(undefined), false);
  assert.equal(isAddress("0xnothex"), false);
  assert.equal(isAddress("FB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"), false);
  assert.equal(isAddress("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d35"), false);
  assert.equal(isAddress("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d3590"), false);
});

test("isChecksumAddress accepts the canonical EIP-55 mixed-case vector", () => {
  assert.equal(isChecksumAddress(CANONICAL), true);
});

test("isChecksumAddress accepts all-lowercase and all-uppercase addresses", () => {
  assert.equal(isChecksumAddress(CANONICAL.toLowerCase()), true);
  // Upper-case body, lower-case 0x prefix per EIP-55 examples.
  assert.equal(isChecksumAddress("0xFB6916095CA1DF60BB79CE92CE3EA74C37C5D359"), true);
});

test("isChecksumAddress rejects mixed-case addresses that fail EIP-55", () => {
  // First letter flipped from CANONICAL.
  assert.equal(isChecksumAddress("0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"), false);
  // Last letter flipped from CANONICAL.
  assert.equal(isChecksumAddress("0xfB6916095ca1df60bB79CE92cE3Ea74c37c5d359"), false);
});

test("isChecksumAddress accepts extra EIP-55 vectors", () => {
  assert.equal(isChecksumAddress("0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB"), true);
  assert.equal(isChecksumAddress("0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"), true);
});

test("isChecksumAddress rejects nibble-flipped variants of valid vectors", () => {
  // Same case pattern as CANONICAL but last hex char nibble flipped: this is
  // a different address, so its EIP-55 case pattern no longer matches.
  assert.equal(isChecksumAddress("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d35a"), false);
});

test("isChecksumAddress rejects bad shapes", () => {
  assert.equal(isChecksumAddress(""), false);
  assert.equal(isChecksumAddress(null), false);
  assert.equal(isChecksumAddress("0xnothex"), false);
});

test("isStrictAddress = isAddress AND isChecksumAddress", () => {
  assert.equal(isStrictAddress(CANONICAL), true);
  assert.equal(isStrictAddress(CANONICAL.toLowerCase()), true);
  assert.equal(isStrictAddress("0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"), false);
  assert.equal(isStrictAddress("0xnothex"), false);
  assert.equal(isStrictAddress(null), false);
});
