"use strict";

const { privateKeyToAccount } = require("viem/accounts");
const { recoverTypedDataAddress, getAddress, isAddress } = require("viem");
const { payloadHash } = require("./proof-canonical");

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
  const type = String(trigger.type || "");
  const id = String(trigger.id || "");
  return `${type}:${id}`;
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

function buildTypedData(proof, payloadHashHex) {
  return {
    domain: DOMAIN,
    types: TYPES,
    primaryType: PRIMARY_TYPE,
    message: buildTypedMessage(proof, payloadHashHex)
  };
}

async function signProof(proof, privateKey) {
  if (!privateKey) throw new Error("signProof: private key required");
  const account = privateKeyToAccount(privateKey);
  const payloadHashHex = payloadHash(proof);
  const typed = buildTypedData(proof, payloadHashHex);
  const signature = await account.signTypedData(typed);
  return {
    signatureScheme: SCHEME,
    payloadHash: payloadHashHex,
    signature,
    signer: getAddress(account.address),
    signedAt: new Date().toISOString()
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

async function verifyProof(proof, options = {}) {
  if (!isSignedProof(proof)) {
    return unsignedResult("not_signed");
  }
  const declaredSigner = typeof proof.signer === "string" && isAddress(proof.signer)
    ? getAddress(proof.signer)
    : null;
  const baseResult = {
    signed: true,
    verified: false,
    signer: declaredSigner,
    recovered: null,
    signatureScheme: proof.signatureScheme,
    payloadHash: proof.payloadHash,
    reason: null
  };

  if (proof.signatureScheme !== SCHEME) {
    return { ...baseResult, reason: "unknown_scheme" };
  }

  let computedHash;
  try {
    computedHash = payloadHash(proof);
  } catch (error) {
    return { ...baseResult, reason: `canonicalize_failed:${error.message}` };
  }
  if (computedHash !== proof.payloadHash) {
    return { ...baseResult, reason: "payload_hash_mismatch" };
  }

  const typed = buildTypedData(proof, computedHash);
  let recovered;
  try {
    recovered = await recoverTypedDataAddress({
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
      signature: proof.signature
    });
  } catch (error) {
    return { ...baseResult, reason: `signature_invalid:${error.message}` };
  }

  const recoveredChecksum = getAddress(recovered);
  const result = { ...baseResult, recovered: recoveredChecksum };

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

async function recoverSigner(proof) {
  const result = await verifyProof(proof);
  return result.recovered;
}

function assertSignerMatches(privateKey, expectedSigner) {
  if (!privateKey) throw new Error("assertSignerMatches: private key required");
  if (!expectedSigner) throw new Error("assertSignerMatches: expected signer required");
  if (!isAddress(expectedSigner)) {
    throw new Error(`ORBIT_AGENT_SIGNER is not a valid address: ${expectedSigner}`);
  }
  const account = privateKeyToAccount(privateKey);
  const derived = getAddress(account.address);
  const expected = getAddress(expectedSigner);
  if (derived !== expected) {
    throw new Error(`signer mismatch: wallet derives ${derived} but ORBIT_AGENT_SIGNER is ${expected}`);
  }
  return derived;
}

module.exports = {
  DOMAIN,
  PRIMARY_TYPE,
  SCHEME,
  TYPES,
  assertSignerMatches,
  buildTypedData,
  buildTypedMessage,
  isSignedProof,
  recoverSigner,
  signProof,
  verifyProof
};
