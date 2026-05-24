"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { canonicalize, stripSignatureEnvelope } = require("./proof-canonical");
const { isAddress } = require("./addresses");
const {
  assertSafePublicReply,
  readSafeTextFile,
  writeSafeTextFile
} = require("./safety");

const ANCHOR_LEDGER_PATH = "memory/merkle-anchors.json";
const PROOF_DIR = "runtime/proofs";
const ZERO_ROOT = "0x" + "0".repeat(64);

// --- hashing primitives --------------------------------------------------

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function bytesFromHex(hex) {
  const cleaned = String(hex || "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]*$/.test(cleaned) || cleaned.length % 2 !== 0) {
    throw new Error(`invalid hex string: ${hex}`);
  }
  return Buffer.from(cleaned, "hex");
}

function hashPair(leftHex, rightHex) {
  // Standard sorted-concatenation pair hashing (Bitcoin-style with sort): if
  // left < right (hex lexicographic), concat(left, right); else concat(right, left).
  // This means stored proofs never need a "position" field — verification re-sorts.
  const leftClean = String(leftHex || "").replace(/^0x/i, "").toLowerCase();
  const rightClean = String(rightHex || "").replace(/^0x/i, "").toLowerCase();
  const [a, b] = leftClean <= rightClean ? [leftClean, rightClean] : [rightClean, leftClean];
  const buf = Buffer.concat([bytesFromHex(a), bytesFromHex(b)]);
  return "0x" + sha256Hex(buf);
}

// --- leaf computation ----------------------------------------------------

function computeLeafHash(proofObject) {
  if (!proofObject || typeof proofObject !== "object") {
    throw new Error("computeLeafHash: proof object required");
  }
  // Canonicalize the proof body excluding the signature envelope. This means
  // even if the signature changes (e.g., re-signing), the leaf is stable for
  // the same canonical content. Per D-006, signed proofs already carry their
  // own payloadHash, but we hash here independently for the anchor.
  const body = stripSignatureEnvelope(proofObject);
  const canonical = canonicalize(body);
  return "0x" + sha256Hex(Buffer.from(canonical, "utf-8"));
}

// --- tree construction ---------------------------------------------------

function normalizeLeaves(leaves) {
  if (!Array.isArray(leaves)) throw new Error("buildMerkleTree: leaves must be an array");
  return leaves.map((leaf, index) => {
    if (typeof leaf !== "string") {
      throw new Error(`buildMerkleTree: leaf ${index} is not a hex string`);
    }
    const value = leaf.startsWith("0x") || leaf.startsWith("0X") ? leaf : `0x${leaf}`;
    bytesFromHex(value); // validate
    return value.toLowerCase();
  });
}

function buildMerkleTree(leaves) {
  const normalized = normalizeLeaves(leaves);
  if (normalized.length === 0) {
    return { root: ZERO_ROOT, layers: [[]], leafCount: 0 };
  }
  if (normalized.length === 1) {
    return { root: normalized[0], layers: [normalized.slice()], leafCount: 1 };
  }

  const layers = [normalized.slice()];
  let current = normalized.slice();
  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      next.push(hashPair(left, right));
    }
    layers.push(next);
    current = next;
  }
  return { root: current[0], layers, leafCount: normalized.length };
}

function computeMerkleRoot(leaves) {
  return buildMerkleTree(leaves).root;
}

// --- inclusion proofs ----------------------------------------------------

function generateProof(tree, leafIndex) {
  if (!tree || !Array.isArray(tree.layers)) {
    throw new Error("generateProof: tree required");
  }
  const leafCount = tree.leafCount;
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= leafCount) {
    throw new Error(`generateProof: leafIndex ${leafIndex} out of range (0..${leafCount - 1})`);
  }
  const proof = [];
  let index = leafIndex;
  for (let layer = 0; layer < tree.layers.length - 1; layer += 1) {
    const nodes = tree.layers[layer];
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : (index + 1 < nodes.length ? index + 1 : index);
    proof.push({
      hash: nodes[siblingIndex],
      position: isRight ? "left" : "right"
    });
    index = Math.floor(index / 2);
  }
  return proof;
}

function verifyProof(leafHash, proof, root) {
  if (!Array.isArray(proof)) return false;
  let current = String(leafHash || "").toLowerCase();
  if (!current.startsWith("0x")) current = `0x${current}`;
  try {
    bytesFromHex(current);
  } catch {
    return false;
  }
  for (const step of proof) {
    if (!step || typeof step.hash !== "string") return false;
    let sibling = step.hash.toLowerCase();
    if (!sibling.startsWith("0x")) sibling = `0x${sibling}`;
    try {
      bytesFromHex(sibling);
    } catch {
      return false;
    }
    // Sorted-concatenation: ignore stored position (it can't be adversarial).
    current = hashPair(current, sibling);
  }
  return current.toLowerCase() === String(root || "").toLowerCase();
}

// --- proof collection ----------------------------------------------------

function listProofFiles(repoRoot) {
  const proofDir = path.join(repoRoot, PROOF_DIR);
  const out = [];
  let dayEntries;
  try {
    dayEntries = fs.readdirSync(proofDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of dayEntries) {
    if (!entry.isDirectory()) continue;
    const dayDir = path.join(proofDir, entry.name);
    let files;
    try {
      files = fs.readdirSync(dayDir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      out.push({
        path: `${PROOF_DIR}/${entry.name}/${file}`,
        absolute: path.join(dayDir, file),
        day: entry.name,
        name: file
      });
    }
  }
  return out;
}

function parseTimestampFromFileName(name) {
  // Names look like 2026-05-23T04-07-35-378Z.json. We parse back into ISO.
  const stripped = String(name || "").replace(/\.json$/i, "");
  const match = stripped.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!match) return null;
  const [, day, hh, mm, ss, ms] = match;
  const iso = `${day}T${hh}:${mm}:${ss}.${ms}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function collectProofs(repoRoot, windowHours = 24, now = new Date()) {
  if (!repoRoot) throw new Error("collectProofs: repoRoot required");
  const windowMs = Math.max(0, Number(windowHours) || 0) * 60 * 60 * 1000;
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    throw new Error("collectProofs: invalid now");
  }
  const windowStart = nowDate.getTime() - windowMs;
  const files = listProofFiles(repoRoot);
  const results = [];
  for (const file of files) {
    const ts = parseTimestampFromFileName(file.name);
    if (!ts) continue;
    const t = ts.getTime();
    if (t < windowStart || t > nowDate.getTime()) continue;

    let raw;
    try {
      raw = fs.readFileSync(file.absolute, "utf-8");
    } catch {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    let hash;
    try {
      hash = computeLeafHash(parsed);
    } catch {
      continue;
    }
    results.push({
      cycle: parsed.cycle == null ? null : Number(parsed.cycle),
      hash,
      signedProofPath: file.path,
      finishedAt: parsed.finishedAt || null,
      timestamp: ts.toISOString()
    });
  }
  results.sort((a, b) => {
    if (a.timestamp < b.timestamp) return -1;
    if (a.timestamp > b.timestamp) return 1;
    return 0;
  });
  return results;
}

// --- ledger --------------------------------------------------------------

function defaultLedger() {
  return { anchors: [] };
}

function loadAnchorLedger(repoRoot) {
  try {
    const parsed = JSON.parse(readSafeTextFile(repoRoot, ANCHOR_LEDGER_PATH));
    if (parsed && Array.isArray(parsed.anchors)) return parsed;
    return defaultLedger();
  } catch {
    return defaultLedger();
  }
}

function saveAnchorLedger(repoRoot, ledger) {
  const value = ledger && Array.isArray(ledger.anchors) ? ledger : defaultLedger();
  writeSafeTextFile(
    repoRoot,
    ANCHOR_LEDGER_PATH,
    `${JSON.stringify(value, null, 2)}\n`
  );
  return value;
}

// --- idempotency ---------------------------------------------------------

function anchorIdempotencyKey(windowEndIso) {
  const value = String(windowEndIso || "").trim();
  return crypto
    .createHash("sha256")
    .update(`orbit-merkle-anchor:${value}`)
    .digest("hex")
    .slice(0, 32);
}

// --- gating --------------------------------------------------------------

function isAnchorEnabled(config = {}, state = {}) {
  const anchor = (config && config.anchor) || {};
  if (!anchor.enabled) {
    return { ok: false, reason: "ORBIT_ENABLE_MERKLE_ANCHOR is not true" };
  }
  if (state.preLaunchVerified !== true) {
    return { ok: false, reason: "state.preLaunchVerified is not true (D-018 pre-launch gate)" };
  }
  if (!anchor.contractAddress || !isAddress(anchor.contractAddress)) {
    return { ok: false, reason: "anchor contract address is not set or invalid" };
  }
  return { ok: true };
}

// --- proposal / execution ------------------------------------------------

function normalizeWindowEndIso(input, now = new Date()) {
  if (input == null || input === "") {
    return (now instanceof Date ? now : new Date(now)).toISOString();
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`windowEndIso is not a valid ISO 8601 date: ${input}`);
  }
  return date.toISOString();
}

function normalizeRationale(raw) {
  const value = String(raw == null ? "" : raw).trim();
  if (!value) return "";
  if (value.length > 240) throw new Error("rationale must be <= 240 chars");
  assertSafePublicReply(value);
  return value;
}

function anchorApprovalIssueBody({ idem, root, leafCount, windowEndIso, windowHours, rationale, dryRun, contractAddress }) {
  const lines = [
    "Orbit is requesting public owner approval to anchor a daily Merkle root of cycle proofs on Base.",
    "",
    `Idempotency key: \`${idem}\``,
    `Window end (ISO): \`${windowEndIso}\``,
    `Window length (hours): \`${windowHours}\``,
    `Merkle root: \`${root}\``,
    `Leaf count: \`${leafCount}\``,
    `Anchor contract: \`${contractAddress || "(unset)"}\``,
    `Mode: \`${dryRun ? "DRY_RUN" : "LIVE"}\``
  ];
  if (rationale) {
    lines.push("", `Rationale: ${rationale}`);
  }
  lines.push(
    "",
    "Per D-012 and D-014, no on-chain anchor transaction will happen until the owner approves this issue.",
    "Per D-018, the agent will additionally refuse if the pre-launch gate has not been verified.",
    "",
    "To approve, the configured owner must add this exact standalone comment:",
    "",
    `\`APPROVE ORBIT-MERKLE-ANCHOR ${idem}\``,
    "",
    "To reject, the configured owner must add this exact standalone comment:",
    "",
    `\`REJECT ORBIT-MERKLE-ANCHOR ${idem}\``
  );
  return lines.join("\n");
}

function commentApprovesAnchor(ownerUsername, comment, idem) {
  const author = (comment && (comment.author || comment.user)) || "";
  const owner = String(ownerUsername || "").trim();
  if (!owner) return null;
  const fromOwner = String(author).toLowerCase() === owner.toLowerCase();
  if (!fromOwner) return null;
  const body = (comment && comment.body) || "";
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(`APPROVE ORBIT-MERKLE-ANCHOR ${idem}`)) return "approved";
  if (lines.includes(`REJECT ORBIT-MERKLE-ANCHOR ${idem}`)) return "rejected";
  return null;
}

async function proposeAnchor(config, context, params = {}) {
  const state = (context && context.state) || {};
  const gate = isAnchorEnabled(config, state);
  if (!gate.ok) {
    return {
      ok: false,
      blocked: true,
      reason: gate.reason,
      status: "blocked_precondition"
    };
  }

  const anchor = config.anchor || {};
  const windowHours = Number(anchor.windowHours || 24);
  const now = params.now instanceof Date ? params.now : new Date(params.now || Date.now());
  const windowEndIso = normalizeWindowEndIso(params.windowEndIso, now);
  const rationale = normalizeRationale(params.rationale);
  const idem = anchorIdempotencyKey(windowEndIso);

  // Collect proofs in the window ending at windowEndIso.
  const proofs = collectProofs(config.repoRoot, windowHours, new Date(windowEndIso));
  const leaves = proofs.map((p) => p.hash);
  const root = computeMerkleRoot(leaves);
  const leafCount = leaves.length;
  const dryRun = anchor.dryRun !== false; // default true
  const contractAddress = anchor.contractAddress || "";

  const ledger = loadAnchorLedger(config.repoRoot);
  let entry = ledger.anchors.find((item) => item.idem === idem);
  if (entry && entry.status && entry.status !== "rejected" && entry.status !== "failed") {
    return {
      ok: true,
      dryRun,
      proposalIssueUrl: entry.proposalIssueUrl || null,
      ledgerEntry: entry,
      root: entry.root,
      leafCount: entry.leafCount,
      idem,
      idempotent: true,
      status: "proposed_existing"
    };
  }

  const title = `[orbit anchor] propose Merkle anchor ${leafCount} leaves ${dryRun ? "(DRY_RUN)" : ""}`.trim();
  const body = anchorApprovalIssueBody({
    idem,
    root,
    leafCount,
    windowEndIso,
    windowHours,
    rationale,
    dryRun,
    contractAddress
  });
  assertSafePublicReply(`${title}\n${body}`);

  let proposalIssueUrl = null;
  let proposalIssueNumber = null;
  const github = context && context.github;
  if (github && typeof github.createIssue === "function") {
    const labels = [
      anchor.approvalIssueLabel || config.approvalIssueLabel || "orbit:approval",
      "orbit:merkle-anchor"
    ].filter(Boolean);
    const issue = await github.createIssue({ title, body, labels });
    if (issue) {
      proposalIssueUrl = issue.html_url || issue.url || null;
      proposalIssueNumber = issue.number || null;
    }
  }

  const at = new Date().toISOString();
  const newEntry = {
    idem,
    windowEndIso,
    windowHours,
    root,
    leafCount,
    rationale,
    dryRun,
    approved: false,
    proposalIssueUrl,
    proposalIssueNumber,
    txHash: null,
    status: dryRun ? "proposed_dry" : "proposed",
    at
  };

  if (entry) {
    Object.assign(entry, newEntry);
  } else {
    ledger.anchors.push(newEntry);
    entry = newEntry;
  }
  saveAnchorLedger(config.repoRoot, ledger);

  return {
    ok: true,
    dryRun,
    proposalIssueUrl,
    proposalIssueNumber,
    ledgerEntry: entry,
    root,
    leafCount,
    idem,
    status: dryRun ? "proposed_dry" : "proposed"
  };
}

function syntheticDryRunTxHash(idem) {
  const tag = "anc";
  const padded = `${tag}${idem}`.padEnd(64, "0").slice(0, 64);
  return `0x${padded}`;
}

async function findApprovalLabelAndComment({ github, proposalIssueNumber, ownerUsername, idem, approvalAcceptedLabel }) {
  if (!github || !proposalIssueNumber) {
    return { labeled: false, owner: false, status: "missing_github" };
  }
  let issue = null;
  if (typeof github.getIssue === "function") {
    issue = await github.getIssue(proposalIssueNumber);
  } else if (typeof github.listIssues === "function") {
    const issues = await github.listIssues({ state: "all", perPage: 100 });
    issue = issues.find((item) => item.number === proposalIssueNumber) || null;
  }
  if (!issue) return { labeled: false, owner: false, status: "issue_not_found" };

  const labels = Array.isArray(issue.labels)
    ? issue.labels
        .map((label) => (typeof label === "string" ? label : label && label.name) || "")
        .map((l) => l.toLowerCase())
    : [];
  const acceptedLabel = String(approvalAcceptedLabel || "orbit:approved").toLowerCase();
  const labeled = labels.includes(acceptedLabel);

  let ownerApproved = false;
  if (typeof github.listIssueComments === "function") {
    const comments = await github.listIssueComments(proposalIssueNumber);
    for (const comment of comments) {
      const verdict = commentApprovesAnchor(ownerUsername, comment, idem);
      if (verdict === "approved") {
        ownerApproved = true;
        break;
      }
      if (verdict === "rejected") {
        return { labeled, owner: false, status: "owner_rejected" };
      }
    }
  }

  return {
    labeled,
    owner: ownerApproved,
    status: labeled && ownerApproved ? "approved" : "pending"
  };
}

async function executeAnchor(config, context, params = {}) {
  const state = (context && context.state) || {};
  const gate = isAnchorEnabled(config, state);
  if (!gate.ok) {
    return {
      ok: false,
      blocked: true,
      reason: gate.reason,
      status: "blocked_precondition",
      dryRun: Boolean(config.anchor && config.anchor.dryRun !== false)
    };
  }

  const anchor = config.anchor || {};
  const dryRun = anchor.dryRun !== false; // default true

  const proposalIssueNumber = Number.parseInt(params.proposalIssueNumber, 10);
  if (!Number.isInteger(proposalIssueNumber) || proposalIssueNumber <= 0) {
    return {
      ok: false,
      blocked: true,
      reason: "proposalIssueNumber is required",
      status: "blocked_invalid_input",
      dryRun
    };
  }

  const ledger = loadAnchorLedger(config.repoRoot);
  const entry = ledger.anchors.find((item) => item.proposalIssueNumber === proposalIssueNumber);
  if (!entry) {
    return {
      ok: false,
      blocked: true,
      reason: "no ledger entry for proposalIssueNumber",
      status: "blocked_no_proposal",
      dryRun
    };
  }

  // Approval gate (D-014).
  const approval = await findApprovalLabelAndComment({
    github: context && context.github,
    proposalIssueNumber,
    ownerUsername: config.ownerUsername,
    idem: entry.idem,
    approvalAcceptedLabel: config.approvalAcceptedLabel
  });

  if (!approval.labeled || !approval.owner) {
    entry.approved = false;
    entry.lastCheckedAt = new Date().toISOString();
    entry.status = approval.status === "owner_rejected" ? "rejected" : "pending_approval";
    saveAnchorLedger(config.repoRoot, ledger);
    return {
      ok: false,
      blocked: true,
      reason: approval.status === "owner_rejected"
        ? "owner rejected the approval comment"
        : "approval issue missing accepted label or owner approval comment",
      status: entry.status,
      dryRun
    };
  }

  entry.approved = true;
  entry.approvedAt = new Date().toISOString();

  if (dryRun) {
    const txHash = syntheticDryRunTxHash(entry.idem);
    entry.txHash = txHash;
    entry.status = "executed_dry";
    entry.executedAt = new Date().toISOString();
    saveAnchorLedger(config.repoRoot, ledger);
    return {
      ok: true,
      dryRun: true,
      txHash,
      root: entry.root,
      leafCount: entry.leafCount,
      idem: entry.idem,
      status: "executed_dry"
    };
  }

  // Live path: deliberately not wired. The on-chain submission depends on the
  // wallet helper (src/agent/wallet.js); until it lands and is owner-approved,
  // we refuse to send a real transaction.
  let walletAvailable = false;
  try {
    const wallet = require("./wallet");
    walletAvailable = wallet && typeof wallet.sendAnchorTransaction === "function";
  } catch {
    walletAvailable = false;
  }
  if (!walletAvailable) {
    entry.status = "blocked_live_unavailable";
    entry.executedAt = null;
    saveAnchorLedger(config.repoRoot, ledger);
    return {
      ok: false,
      blocked: true,
      dryRun: false,
      reason: "live anchor execution is not wired; refusing to send a real transaction",
      status: "blocked_live_unavailable"
    };
  }

  entry.status = "blocked_live_unavailable";
  entry.executedAt = null;
  saveAnchorLedger(config.repoRoot, ledger);
  return {
    ok: false,
    blocked: true,
    dryRun: false,
    reason: "live anchor execution path requires explicit operator wiring; refusing to send a real transaction",
    status: "blocked_live_unavailable"
  };
}

// --- receipt formatting --------------------------------------------------

function formatAnchorReceipt(entry = {}) {
  return {
    kind: "merkle_anchor",
    idem: entry.idem || null,
    windowEndIso: entry.windowEndIso || null,
    windowHours: entry.windowHours == null ? null : entry.windowHours,
    root: entry.root || null,
    leafCount: entry.leafCount == null ? null : entry.leafCount,
    approved: Boolean(entry.approved),
    dryRun: Boolean(entry.dryRun),
    txHash: entry.txHash || null,
    status: entry.status || "unknown",
    proposalIssueUrl: entry.proposalIssueUrl || null,
    at: entry.executedAt || entry.approvedAt || entry.at || null
  };
}

module.exports = {
  ANCHOR_LEDGER_PATH,
  ZERO_ROOT,
  anchorIdempotencyKey,
  buildMerkleTree,
  collectProofs,
  commentApprovesAnchor,
  computeLeafHash,
  computeMerkleRoot,
  executeAnchor,
  formatAnchorReceipt,
  generateProof,
  hashPair,
  isAnchorEnabled,
  loadAnchorLedger,
  proposeAnchor,
  saveAnchorLedger,
  syntheticDryRunTxHash,
  verifyProof
};
