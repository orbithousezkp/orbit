"use strict";

const { keccak256, toBytes } = require("viem");

const SIGNATURE_ENVELOPE_KEYS = [
  "signature",
  "signer",
  "signedAt",
  "signatureScheme",
  "payloadHash",
  // `cast` is appended to the proof AFTER signing (see farcaster block
  // in run.js). It's post-signing metadata: editing it must not invalidate
  // the signature, and re-verification must not include it in the hash.
  // Cast integrity is the farcaster ledger's job, not the cycle proof's.
  "cast"
];

const MAX_CANONICAL_BYTES = 2 * 1024 * 1024;

function canonicalize(value) {
  if (value === undefined) {
    throw new Error("canonicalize: undefined is not representable");
  }
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalize: non-finite number");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}

function stripSignatureEnvelope(proof) {
  const body = { ...proof };
  for (const key of SIGNATURE_ENVELOPE_KEYS) delete body[key];
  return body;
}

function canonicalBody(proof) {
  const text = canonicalize(stripSignatureEnvelope(proof));
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_CANONICAL_BYTES) {
    throw new Error(`canonical body ${bytes} bytes exceeds ${MAX_CANONICAL_BYTES} byte limit`);
  }
  return text;
}

function payloadHash(proof) {
  return keccak256(toBytes(canonicalBody(proof)));
}

module.exports = {
  MAX_CANONICAL_BYTES,
  SIGNATURE_ENVELOPE_KEYS,
  canonicalBody,
  canonicalize,
  payloadHash,
  stripSignatureEnvelope
};
