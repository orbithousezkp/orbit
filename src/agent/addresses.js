"use strict";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^0x[a-fA-F0-9]{64}$/;

function isAddress(value) {
  return ADDRESS_RE.test(String(value || ""));
}

function isPrivateKey(value) {
  return PRIVATE_KEY_RE.test(String(value || ""));
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
  isPrivateKey
};
