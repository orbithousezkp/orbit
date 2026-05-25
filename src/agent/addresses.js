"use strict";

// EVM address utilities.
//
// `isAddress` is shape-only: it accepts any 0x-prefixed 40-char hex string
// regardless of letter case. That is sufficient for parsing but NOT for
// validating addresses pasted into env vars or governance docs: a typo that
// swaps two valid hex characters passes the shape check, and a downstream
// transfer can send funds to an address nobody controls.
//
// `isChecksumAddress` enforces EIP-55: a mixed-case address must match the
// keccak256-derived case pattern exactly. All-lowercase and all-uppercase
// addresses are accepted (EIP-55 treats them as uncheck­summed; we cannot
// detect typos in that case, but rejecting them would break compatibility
// with tools that emit lowercase addresses).
//
// `isStrictAddress` is the combined check: shape + EIP-55. Callers that
// touch money or write to on-chain state should use this one.

const { keccak256, toBytes } = require("viem");

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^0x[a-fA-F0-9]{64}$/;

function isAddress(value) {
  return ADDRESS_RE.test(String(value || ""));
}

function isPrivateKey(value) {
  return PRIVATE_KEY_RE.test(String(value || ""));
}

// EIP-55 checksum validation.
//
// Returns true when `value` is a 0x-prefixed 40-char hex string AND either:
//   - has no letters of mixed case (all-lowercase or all-uppercase), OR
//   - each letter's case matches the EIP-55 checksum derived from
//     keccak256(lowercase_hex_without_0x_as_utf8_bytes).
//
// The keccak256 input is the UTF-8 bytes of the lowercased hex string (NOT
// the decoded hex bytes) per EIP-55.
function isChecksumAddress(value) {
  if (!isAddress(value)) return false;
  const str = String(value);
  const body = str.slice(2);
  const hasUpper = /[A-F]/.test(body);
  const hasLower = /[a-f]/.test(body);
  // All-lowercase or all-uppercase: treat as uncheck­summed and accept.
  if (!(hasUpper && hasLower)) return true;
  const lower = body.toLowerCase();
  const hash = keccak256(toBytes(lower)).slice(2);
  for (let i = 0; i < 40; i++) {
    const c = body[i];
    if (c >= "0" && c <= "9") continue;
    const nibble = parseInt(hash[i], 16);
    const expectUpper = nibble >= 8;
    const isUpper = c >= "A" && c <= "F";
    if (expectUpper !== isUpper) return false;
  }
  return true;
}

// Combined shape + EIP-55 check. Use this for any address that gates a
// transfer, a Safe lookup, or anything else where a typo could lose funds.
function isStrictAddress(value) {
  return isAddress(value) && isChecksumAddress(value);
}

function assertAddress(value, label = "address") {
  if (!isAddress(value)) {
    throw new Error(`${label} must be a 20-byte EVM address`);
  }
  return value;
}

function assertPrivateKey(value, label = "private key") {
  if (!isPrivateKey(value)) {
    throw new Error(`${label} must be a 32-byte 0x-prefixed private key`);
  }
  return value;
}

module.exports = {
  assertAddress,
  assertPrivateKey,
  isAddress,
  isChecksumAddress,
  isPrivateKey,
  isStrictAddress
};
