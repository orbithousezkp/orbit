"use strict";

// Founder-handoff executor (FOUNDER_HANDOFF.md §4, Patch Set V).
//
// The lifecycle in handoff.js advances to EXECUTING once the 7-day
// timelock expires; tickHandoffs then calls an injected executor. This
// module IS that executor — minimal but real.
//
// What we produce: a per-handoff "completion bundle" JSON at
// runtime/handoff/bundle-{id}.json. The bundle is the artifact a
// maintainer (or the founder before stepping back) needs to actually
// land the change:
//
//   - signer-rotation: encoded Safe addOwnerWithThreshold tx data,
//     the Safe address it should be sent to, and a checklist.
//   - maintainer-list-change: the new ORBIT_MAINTAINERS string + the
//     `gh variable set` command to apply it.
//   - privilege-reduction: a config diff for memory/governance.json.
//
// The bundle is committed to the repo — under runtime/ — so the
// artifact lives in git history. The actual on-chain Safe tx is
// expressly NOT signed or sent from CI: the project's whole point is
// that the founder explicitly relinquishes control through a process
// they can audit, and "the cycle quietly signed and broadcasted the
// rotation" defeats that. The bundle is the deliberate hand-off
// surface.
//
// This file has no on-chain side effects and adds no dependencies.

const fs = require("node:fs");
const path = require("node:path");
const { atomicWriteFile } = require("./safety");

const BUNDLE_DIR = "runtime/handoff";
const ADD_OWNER_WITH_THRESHOLD_SELECTOR = "0x0d582f13";   // addOwnerWithThreshold(address,uint256)
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

function ensureBundleDir(repoRoot) {
  const abs = path.join(repoRoot, BUNDLE_DIR);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

function bundlePath(repoRoot, handoff) {
  return path.join(repoRoot, BUNDLE_DIR, `bundle-${handoff.id}.json`);
}

// Encode an EVM address into 32-byte zero-padded hex (left-padded).
function padAddress(addr) {
  if (typeof addr !== "string" || !ADDRESS_REGEX.test(addr)) {
    throw new Error(`padAddress: not a valid EVM address: ${addr}`);
  }
  return addr.slice(2).toLowerCase().padStart(64, "0");
}

// Encode a uint256 as 32-byte hex.
function padUint256(value) {
  const n = BigInt(value);
  if (n < 0n) throw new Error(`padUint256: negative ${value}`);
  return n.toString(16).padStart(64, "0");
}

// Build the Safe addOwnerWithThreshold tx data: 4-byte selector +
// 32-byte address + 32-byte uint256. Pure function; no I/O.
function encodeAddOwnerWithThreshold(newOwner, threshold) {
  return ADD_OWNER_WITH_THRESHOLD_SELECTOR + padAddress(newOwner) + padUint256(threshold);
}

function buildSignerRotationBundle(handoff, options) {
  const opts = options || {};
  if (!opts.safeAddress) {
    throw new Error("buildSignerRotationBundle: options.safeAddress required");
  }
  if (!ADDRESS_REGEX.test(handoff.to)) {
    throw new Error("buildSignerRotationBundle: handoff.to must be an EVM address for signer-rotation");
  }
  const threshold = Number.isFinite(Number(opts.threshold)) ? Number(opts.threshold) : 1;
  if (threshold < 1) {
    throw new Error("buildSignerRotationBundle: threshold must be >= 1");
  }
  return {
    kind: "signer-rotation",
    safeAddress: opts.safeAddress,
    txTo: opts.safeAddress,
    txValue: "0",
    txData: encodeAddOwnerWithThreshold(handoff.to, threshold),
    selector: ADD_OWNER_WITH_THRESHOLD_SELECTOR,
    function: "addOwnerWithThreshold(address,uint256)",
    arguments: { newOwner: handoff.to, threshold },
    instructions: [
      "1. Open the Safe at safeAddress in the Safe app.",
      "2. New transaction -> Contract interaction.",
      `3. Paste txData (or use addOwnerWithThreshold with newOwner=${handoff.to}, threshold=${threshold}).`,
      "4. Collect K-of-N signatures per the Safe's existing threshold.",
      "5. Execute. Record the txHash back into memory/handoff.json under handoff.executedTxHash.",
      "6. Once mined, the new owner can sign for future Safe actions."
    ]
  };
}

function buildMaintainerListChangeBundle(handoff) {
  // handoff.to is a comma-separated list of GitHub handles.
  const next = String(handoff.to || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (next.length === 0) {
    throw new Error("buildMaintainerListChangeBundle: handoff.to must be a non-empty comma list");
  }
  return {
    kind: "maintainer-list-change",
    newMaintainers: next,
    ghCommand: `gh variable set ORBIT_MAINTAINERS --body "${next.join(",")}"`,
    instructions: [
      "1. Run the ghCommand above (requires repo admin).",
      "2. Verify with: gh variable list | grep ORBIT_MAINTAINERS",
      "3. Next cycle will reload config and the new K-of-N threshold takes effect.",
      "4. Record the change in memory/handoff.json under handoff.executedTxHash with the gh-variable update id."
    ]
  };
}

function buildPrivilegeReductionBundle(handoff) {
  return {
    kind: "privilege-reduction",
    description: String(handoff.rationale || handoff.to || ""),
    instructions: [
      "1. Apply the privilege-reduction change described in handoff.rationale to memory/governance.json.",
      "2. Open a PR with the change, link to the handoff proposal issue.",
      "3. Merge after quorum confirms the diff matches the proposal.",
      "4. Record the merge commit SHA in memory/handoff.json under handoff.executedTxHash."
    ]
  };
}

function buildBundle(handoff, options = {}) {
  switch (handoff.type) {
    case "signer-rotation":
      return buildSignerRotationBundle(handoff, options);
    case "maintainer-list-change":
      return buildMaintainerListChangeBundle(handoff);
    case "privilege-reduction":
      return buildPrivilegeReductionBundle(handoff);
    default:
      throw new Error(`buildBundle: unknown handoff.type ${handoff.type}`);
  }
}

// The executor function passed to handoff.tickHandoffs. Pure-ish:
// produces a bundle, persists it atomically, returns a pointer.
// tickHandoffs then advances the handoff to COMPLETE.
function makeExecutor(repoRoot, options = {}) {
  return async function executor(handoff) {
    const bundle = buildBundle(handoff, options);
    ensureBundleDir(repoRoot);
    const out = bundlePath(repoRoot, handoff);
    const enriched = {
      handoffId: handoff.id,
      handoffType: handoff.type,
      builtAt: new Date().toISOString(),
      ...bundle
    };
    atomicWriteFile(out, JSON.stringify(enriched, null, 2) + "\n");
    return {
      bundlePath: path.relative(repoRoot, out),
      kind: bundle.kind,
      requiresOwnerAction: true
    };
  };
}

module.exports = {
  BUNDLE_DIR,
  ADD_OWNER_WITH_THRESHOLD_SELECTOR,
  buildBundle,
  buildSignerRotationBundle,
  buildMaintainerListChangeBundle,
  buildPrivilegeReductionBundle,
  encodeAddOwnerWithThreshold,
  makeExecutor,
  bundlePath
};
