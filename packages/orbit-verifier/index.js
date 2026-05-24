"use strict";

const { recoverTypedDataAddress, getAddress, isAddress } = require("viem");
const { payloadHash } = require("./canonical");

const SCHEME = "eip712:orbit-cycle-proof/1";

const DOMAIN = {
  name: "Orbit Cycle Proof",
  version: "1",
  chainId: 8453
};

const TYPES = {
  CycleProof: [
    { name: "brand",       type: "string"  },
    { name: "cycle",       type: "uint256" },
    { name: "startedAt",   type: "string"  },
    { name: "finishedAt",  type: "string"  },
    { name: "trigger",     type: "string"  },
    { name: "dryRun",      type: "bool"    },
    { name: "totalSteps",  type: "uint256" },
    { name: "payloadHash", type: "bytes32" }
  ]
};

const PRIMARY_TYPE = "CycleProof";

function normalizeTrigger(trigger) {
  if (!trigger || typeof trigger !== "object") return ":";
  return `${String(trigger.type || "")}:${String(trigger.id || "")}`;
}

function bigIntFrom(value) {
  if (typeof value === "bigint") return value;
  if (value === undefined || value === null || value === "") return 0n;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error(`expected non-negative integer, got ${value}`);
  }
  return BigInt(n);
}

function buildTypedMessage(proof, payloadHashHex) {
  return {
    brand: String(proof.brand || ""),
    cycle: bigIntFrom(proof.cycle),
    startedAt: String(proof.startedAt || ""),
    finishedAt: String(proof.finishedAt || ""),
    trigger: normalizeTrigger(proof.trigger),
    dryRun: Boolean(proof.dryRun),
    totalSteps: bigIntFrom(proof.totalSteps),
    payloadHash: payloadHashHex
  };
}

function isSignedProof(proof) {
  return Boolean(
    proof
      && typeof proof === "object"
      && typeof proof.signature === "string"
      && typeof proof.payloadHash === "string"
      && typeof proof.signatureScheme === "string"
  );
}

function unsignedResult(reason) {
  return {
    signed: false,
    verified: false,
    signer: null,
    recovered: null,
    signatureScheme: null,
    payloadHash: null,
    reason
  };
}

async function verifyProofFile(proof, options = {}) {
  if (!isSignedProof(proof)) {
    return unsignedResult("not_signed");
  }
  const declaredSigner = typeof proof.signer === "string" && isAddress(proof.signer)
    ? getAddress(proof.signer)
    : null;
  const base = {
    signed: true,
    verified: false,
    signer: declaredSigner,
    recovered: null,
    signatureScheme: proof.signatureScheme,
    payloadHash: proof.payloadHash,
    reason: null
  };

  if (proof.signatureScheme !== SCHEME) {
    return { ...base, reason: "unknown_scheme" };
  }

  let computed;
  try {
    computed = payloadHash(proof);
  } catch (error) {
    return { ...base, reason: `canonicalize_failed:${error.message}` };
  }
  if (computed !== proof.payloadHash) {
    return { ...base, reason: "payload_hash_mismatch" };
  }

  const message = buildTypedMessage(proof, computed);
  let recovered;
  try {
    recovered = await recoverTypedDataAddress({
      domain: DOMAIN,
      types: TYPES,
      primaryType: PRIMARY_TYPE,
      message,
      signature: proof.signature
    });
  } catch (error) {
    return { ...base, reason: `signature_invalid:${error.message}` };
  }

  const recoveredChecksum = getAddress(recovered);
  const result = { ...base, recovered: recoveredChecksum };

  if (declaredSigner && declaredSigner !== recoveredChecksum) {
    return { ...result, reason: "recovered_address_mismatch" };
  }

  const expected = options.expectedSigner;
  if (expected) {
    if (!isAddress(expected)) {
      return { ...result, reason: "expected_signer_invalid" };
    }
    if (getAddress(expected) !== recoveredChecksum) {
      return { ...result, reason: "expected_signer_mismatch" };
    }
  }

  return { ...result, verified: true };
}

module.exports = {
  DOMAIN,
  PRIMARY_TYPE,
  SCHEME,
  TYPES,
  buildTypedMessage,
  isSignedProof,
  verifyProofFile
};
