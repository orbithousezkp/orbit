"use strict";

/**
 * Inter-Orbit federation — parse + verify stub (S-022).
 *
 * Implements the wire format, canonicalization, envelope hashing, signature
 * verification (EIP-712 via viem when available), payload risk classification,
 * and the quarantine decision orchestrator described in
 * PLAN/SPECS/FEDERATION.md.
 *
 * Hard rules for this stub:
 *   - No outbound network calls.
 *   - No new npm dependency.
 *   - No cycle-loop wiring (no entry in tools.js/actions.js/run.js).
 *
 * The send path, the inbound pull path, and the cycle-loop handler dispatch
 * all belong to a later phase-3 session. This file is exclusively for parsing
 * and verifying envelopes that arrive from somewhere else, plus the lightweight
 * ledger/peer-list helpers needed to make those checks meaningful.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { canonicalize } = require("./proof-canonical");
const { scanTextRisk } = require("./scam");

const MESSAGE_TYPES = ["HELLO", "INTEL_SHARE", "CAPABILITY_ADVERTISE"];
const ENVELOPE_VERSION = "1";

const DOMAIN = {
  name: "Orbit Federation Envelope",
  version: "1",
  chainId: 8453
};

const TYPES = {
  FederationEnvelope: [
    { name: "version",    type: "string"  },
    { name: "type",       type: "string"  },
    { name: "fromRepo",   type: "string"  },
    { name: "fromSigner", type: "address" },
    { name: "sentAt",     type: "string"  },
    { name: "nonce",      type: "string"  },
    { name: "payloadHash", type: "bytes32" }
  ]
};

const PRIMARY_TYPE = "FederationEnvelope";

const SIGNATURE_REGEX = /^0x[0-9a-fA-F]{130}$/;
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const NONCE_REGEX = /^[A-Za-z0-9_.:-]{4,128}$/;

// Federation-specific high-risk patterns layered on top of scanTextRisk.
const FEDERATION_RISK_PATTERNS = [
  {
    category: "fake_github_token",
    pattern: /\bgh[a-z]_[A-Za-z0-9]{20,}/,
    message: "Payload contains a GitHub personal access token shape."
  },
  {
    category: "fund_routing",
    // EVM address within 80 chars of an action verb.
    pattern: /\b0x[a-fA-F0-9]{40}\b.{0,80}\b(send|transfer|drain|withdraw|sweep|forward|deposit)\b|\b(send|transfer|drain|withdraw|sweep|forward|deposit)\b.{0,80}\b0x[a-fA-F0-9]{40}\b/i,
    message: "Payload combines an EVM address with a fund-movement verb."
  },
  {
    category: "market_call",
    pattern: /\b(buy|sell|pump|dump|long|short)\b.{0,40}\b(now|immediately|today|asap)\b|\b(ape into|do not miss|guaranteed gains|moonshot)\b/i,
    message: "Payload contains market-manipulation language."
  },
  {
    category: "approval_request",
    pattern: /\b(approve|set ?approval|increase allowance|permit signature|setapprovalforall)\b/i,
    message: "Payload requests a token approval."
  }
];

// -------- viem availability --------

let viem = null;
let viemLoadAttempted = false;
function tryViem() {
  if (viemLoadAttempted) return viem;
  viemLoadAttempted = true;
  try {
    // eslint-disable-next-line global-require
    viem = require("viem");
  } catch {
    viem = null;
  }
  return viem;
}

// -------- canonical / hash --------

/**
 * Strip the signature and produce a canonical string suitable both for hashing
 * and for the EIP-712 message construction. Order-stable across runs and
 * across key reorderings of the input object (we reuse the same canonicalizer
 * as cycle proofs).
 */
function canonicalEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw new Error("canonicalEnvelope: envelope must be an object");
  }
  const body = { ...envelope };
  delete body.signature;
  return canonicalize(body);
}

/**
 * sha256 of the canonical envelope, hex-encoded with 0x prefix. We use sha256
 * here (not keccak) to keep this layer independent of any EVM concern beyond
 * the EIP-712 typed-data hash that viem computes internally. The envelope
 * hash is what the per-peer dedupe and the audit log refer to.
 */
function computeEnvelopeHash(envelope) {
  const canonical = canonicalEnvelope(envelope);
  return "0x" + crypto.createHash("sha256").update(canonical).digest("hex");
}

// -------- shape checks --------

function envelopeShapeIssue(envelope) {
  if (!envelope || typeof envelope !== "object") return "envelope_not_object";
  if (envelope.version !== ENVELOPE_VERSION) return "version_unsupported";
  if (!MESSAGE_TYPES.includes(envelope.type)) return "unknown_type";
  if (typeof envelope.fromRepo !== "string" || !envelope.fromRepo.includes("/")) return "from_repo_invalid";
  if (typeof envelope.fromSigner !== "string" || !ADDRESS_REGEX.test(envelope.fromSigner)) return "from_signer_invalid";
  if (typeof envelope.sentAt !== "string" || Number.isNaN(Date.parse(envelope.sentAt))) return "sent_at_invalid";
  if (typeof envelope.nonce !== "string" || !NONCE_REGEX.test(envelope.nonce)) return "nonce_invalid";
  if (!envelope.payload || typeof envelope.payload !== "object") return "payload_invalid";
  return null;
}

// -------- signature --------

/**
 * Verify the envelope's EIP-712 signature.
 *
 * Strategy:
 *   - Validate signature shape (0x + 130 hex).
 *   - If viem is available, recover the typed-data signer over a typed-data
 *     message whose `payloadHash` field equals `computeEnvelopeHash(envelope)`.
 *   - Compare the recovered address against `env.fromSigner` (case-insensitive
 *     via getAddress when viem is available, otherwise lowercased compare).
 *   - If viem is NOT available, we fall back to a structural-only success
 *     (signature looks like a 132-char hex string) and return
 *     { ok: true, recoveredSigner: null, mode: "structural" }.
 *     This is a Phase 3 follow-up — production MUST run with viem present.
 */
function verifyEnvelopeSignature(envelope) {
  const shapeIssue = envelopeShapeIssue(envelope);
  if (shapeIssue) {
    return { ok: false, error: shapeIssue };
  }
  if (typeof envelope.signature !== "string" || !SIGNATURE_REGEX.test(envelope.signature)) {
    return { ok: false, error: "signature_malformed" };
  }
  const payloadHashHex = computeEnvelopeHash(envelope);
  const v = tryViem();
  if (!v || typeof v.recoverTypedDataAddress !== "function") {
    // C-3 fail-closed: when viem cannot recover the signer, the envelope is
    // unverifiable. Refuse it instead of returning ok:true with structural
    // mode — accepting unverified signatures would let any malformed deploy
    // accept inbound messages from arbitrary peers. Tests that need to
    // exercise the structural-only path must pass { allowStructural: true }
    // explicitly (see federation.test.js).
    return {
      ok: false,
      payloadHash: payloadHashHex,
      mode: "structural",
      error: "viem_unavailable",
      warning: "signature_verification_unavailable"
    };
  }
  const message = {
    version: envelope.version,
    type: envelope.type,
    fromRepo: envelope.fromRepo,
    fromSigner: envelope.fromSigner,
    sentAt: envelope.sentAt,
    nonce: envelope.nonce,
    payloadHash: payloadHashHex
  };

  // recoverTypedDataAddress is async — wrap in a sync-returning Promise so the
  // caller can await it. We return the promise here intentionally; tests that
  // need the recovered address await this function, while the
  // structural-only branch returns synchronously.
  return v.recoverTypedDataAddress({
    domain: DOMAIN,
    types: TYPES,
    primaryType: PRIMARY_TYPE,
    message,
    signature: envelope.signature
  }).then((recovered) => {
    const recoveredChecksum = typeof v.getAddress === "function" ? v.getAddress(recovered) : recovered;
    const declared = typeof v.getAddress === "function" ? v.getAddress(envelope.fromSigner) : envelope.fromSigner;
    if (recoveredChecksum.toLowerCase() !== declared.toLowerCase()) {
      return {
        ok: false,
        recoveredSigner: recoveredChecksum,
        payloadHash: payloadHashHex,
        mode: "eip712",
        error: "signer_mismatch"
      };
    }
    return {
      ok: true,
      recoveredSigner: recoveredChecksum,
      payloadHash: payloadHashHex,
      mode: "eip712"
    };
  }).catch((error) => ({
    ok: false,
    payloadHash: payloadHashHex,
    mode: "eip712",
    error: `recover_failed:${error && error.message ? error.message : "unknown"}`
  }));
}

/**
 * Build the typed-data structure for a given envelope. Exposed for SDK use and
 * for the future signer (S-026) so signing and verifying both go through the
 * exact same message construction.
 */
function buildTypedData(envelope) {
  const shapeIssue = envelopeShapeIssue(envelope);
  if (shapeIssue) throw new Error(`buildTypedData: ${shapeIssue}`);
  const payloadHashHex = computeEnvelopeHash(envelope);
  return {
    domain: DOMAIN,
    types: TYPES,
    primaryType: PRIMARY_TYPE,
    message: {
      version: envelope.version,
      type: envelope.type,
      fromRepo: envelope.fromRepo,
      fromSigner: envelope.fromSigner,
      sentAt: envelope.sentAt,
      nonce: envelope.nonce,
      payloadHash: payloadHashHex
    }
  };
}

// -------- payload classification --------

/**
 * Run scanTextRisk plus federation-specific patterns over the payload's text
 * field. Returns { risky, reasons[], level, score, flags } where `risky` is
 * true when the layered score reaches the `critical`/`high` thresholds or any
 * federation-specific pattern matches.
 */
function classifyPayload(envelope) {
  const reasons = [];
  const flags = [];
  const text = envelope && envelope.payload && typeof envelope.payload.text === "string"
    ? envelope.payload.text
    : "";

  const baseRisk = scanTextRisk(text);
  for (const flag of baseRisk.flags || []) {
    flags.push(flag);
    if (flag.severity >= 70) reasons.push(`scan:${flag.category}`);
  }

  let federationScore = 0;
  for (const rule of FEDERATION_RISK_PATTERNS) {
    if (rule.pattern.test(text)) {
      reasons.push(`federation:${rule.category}`);
      flags.push({
        severity: 92,
        category: `federation:${rule.category}`,
        message: rule.message
      });
      federationScore = Math.max(federationScore, 92);
    }
  }

  const score = Math.max(baseRisk.score || 0, federationScore);
  const risky = score >= 90 || reasons.length > 0;
  const level = score >= 90 ? "critical" : score >= 70 ? "high" : score >= 40 ? "medium" : score > 0 ? "low" : "clear";

  return { risky, level, score, reasons, flags };
}

// -------- quarantine orchestration --------

/**
 * Synthesizes the quarantine pipeline a–d:
 *   a. envelope shape / canonicalization
 *   b. signature verification
 *   c. fromRepo / fromSigner non-empty (real fetch wired in cycle loop)
 *   d. payload risk classification (federation-critical -> quarantine)
 *
 * Plus an optional peer-status check if a `peers` array is supplied.
 *
 * Returns:
 *   { accept: boolean, quarantineReason?: string, envelopeHash: string,
 *     classification?: object, signatureMode?: string }
 *
 * This function returns a Promise because verifyEnvelopeSignature returns one
 * when viem is available. Callers must await.
 */
async function quarantineDecision(envelope, options = {}) {
  // Step a — shape + canonical (computeEnvelopeHash throws if envelope is bad).
  const shapeIssue = envelopeShapeIssue(envelope);
  if (shapeIssue) {
    return { accept: false, quarantineReason: shapeIssue };
  }
  let envelopeHash;
  try {
    envelopeHash = computeEnvelopeHash(envelope);
  } catch (error) {
    return { accept: false, quarantineReason: `canonicalize_failed:${error.message}` };
  }

  // Optional peer-status guard — if caller passes peers and the from-repo is
  // listed but evicted/paused, we drop without spending CPU on signature work.
  if (Array.isArray(options.peers)) {
    const peer = options.peers.find((p) => p && p.repo === envelope.fromRepo);
    if (peer && peer.status && peer.status !== "active") {
      return {
        accept: false,
        envelopeHash,
        quarantineReason: `peer_${peer.status}`
      };
    }
    // Strict mode: also reject unknown peers.
    if (!peer && options.strictPeerList) {
      return { accept: false, envelopeHash, quarantineReason: "peer_unknown" };
    }
  }

  // Step b — signature verification.
  const sigResult = await Promise.resolve(verifyEnvelopeSignature(envelope));
  if (!sigResult.ok) {
    return {
      accept: false,
      envelopeHash,
      quarantineReason: `signature_invalid:${sigResult.error || "unknown"}`,
      signatureMode: sigResult.mode
    };
  }

  // Step c — repo↔signer binding.
  // Stub: confirm both fields are present and well-formed; the real fetch of
  // the sender's memory/identity.json happens in the cycle-loop wiring.
  if (!envelope.fromRepo || !envelope.fromSigner) {
    return { accept: false, envelopeHash, quarantineReason: "binding_missing" };
  }

  // Step d — payload classification.
  const classification = classifyPayload(envelope);
  if (classification.risky) {
    return {
      accept: false,
      envelopeHash,
      classification,
      signatureMode: sigResult.mode,
      quarantineReason: `risky_payload:${classification.reasons[0] || classification.level}`
    };
  }

  return {
    accept: true,
    envelopeHash,
    classification,
    signatureMode: sigResult.mode,
    recoveredSigner: sigResult.recoveredSigner || null
  };
}

// -------- enablement gate --------

function isFederationEnabled(config = {}, state = {}) {
  const envFlag = process.env.ORBIT_ENABLE_FEDERATION === "true";
  const configFlag = Boolean(config && config.federation);
  if (!envFlag && !configFlag) {
    return { ok: false, reason: "federation_disabled_env" };
  }
  if (state.preLaunchVerified !== true) {
    return { ok: false, reason: "pre_launch_not_verified" };
  }
  return { ok: true };
}

// -------- ledger / peer I/O --------

function ledgerPath(repoRoot) {
  return path.join(repoRoot, "memory", "federation-inbox-ledger.json");
}

function peersPath(repoRoot) {
  return path.join(repoRoot, "memory", "federation-peers.json");
}

function loadInboxLedger(repoRoot) {
  const file = ledgerPath(repoRoot);
  if (!fs.existsSync(file)) {
    return { nonces: {} };
  }
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { nonces: {} };
    return { nonces: parsed.nonces && typeof parsed.nonces === "object" ? parsed.nonces : {} };
  } catch {
    return { nonces: {} };
  }
}

function saveInboxLedger(repoRoot, ledger) {
  const file = ledgerPath(repoRoot);
  const safe = { nonces: ledger && ledger.nonces && typeof ledger.nonces === "object" ? ledger.nonces : {} };
  // Atomic — Patch Set Q. Without this, two cycles ingesting federated
  // messages concurrently could leave a half-written ledger and lose
  // nonce state, allowing replay.
  const { atomicWriteFile } = require("./safety");
  atomicWriteFile(file, JSON.stringify(safe, null, 2) + "\n");
  return file;
}

function loadPeers(repoRoot) {
  const file = peersPath(repoRoot);
  if (!fs.existsSync(file)) return { peers: [] };
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.peers)) return { peers: [] };
    return { peers: parsed.peers };
  } catch {
    return { peers: [] };
  }
}

/**
 * Convenience: record an ingestion decision into the ledger. Returns
 * `{ duplicate: true, previous }` if the nonce is already present, otherwise
 * writes through and returns `{ duplicate: false }`.
 */
function recordLedgerDecision(repoRoot, envelope, decision) {
  const ledger = loadInboxLedger(repoRoot);
  if (ledger.nonces[envelope.nonce]) {
    return { duplicate: true, previous: ledger.nonces[envelope.nonce] };
  }
  ledger.nonces[envelope.nonce] = {
    from: envelope.fromRepo,
    type: envelope.type,
    ingestedAt: new Date().toISOString(),
    decision: decision && decision.accept ? "accepted" : "quarantined",
    reason: decision && decision.accept ? "ok" : (decision && decision.quarantineReason) || "unknown"
  };
  saveInboxLedger(repoRoot, ledger);
  return { duplicate: false };
}

module.exports = {
  DOMAIN,
  ENVELOPE_VERSION,
  FEDERATION_RISK_PATTERNS,
  MESSAGE_TYPES,
  PRIMARY_TYPE,
  TYPES,
  buildTypedData,
  canonicalEnvelope,
  classifyPayload,
  computeEnvelopeHash,
  envelopeShapeIssue,
  isFederationEnabled,
  loadInboxLedger,
  loadPeers,
  ledgerPath,
  peersPath,
  quarantineDecision,
  recordLedgerDecision,
  saveInboxLedger,
  verifyEnvelopeSignature
};
