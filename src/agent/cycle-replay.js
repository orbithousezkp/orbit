"use strict";

// F-1.2 (PLAN/ROADMAP_EXPANSION.md): cycle-rerun forensics.
//
// True LLM replay is non-deterministic (model nondet + provider-side
// randomness). This module is the next-best thing: a pure, read-only
// integrity-and-coherence check on a recorded proof. Catches:
//   - structural drift (missing field, wrong type)
//   - obvious internal contradictions (claimed actions but no files
//     changed; claimed file changes but no recorded action)
//   - signature-shape integrity (signer + signature must both exist, or
//     neither)
//
// Accepts both the old proof shape (actions[] + filesChanged[]) and the
// newer shape (steps[] + filesChanged[]).
//
// Pure: no fs, no signature verification (that's the verifier package's
// job), no LLM calls. Returns a drift report the caller can render in a
// dashboard or fail-fast in CI.

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function activityCount(proof) {
  // Old shape: actions[]. New shape: steps[]. Either qualifies.
  if (Array.isArray(proof.actions)) return proof.actions.length;
  if (Array.isArray(proof.steps)) return proof.steps.length;
  return 0;
}

function replayCycleProof(proof) {
  const drifts = [];
  if (!isPlainObject(proof)) {
    return {
      ok: false,
      drifts: [{ kind: "non_object_root", actual: typeName(proof) }]
    };
  }

  // Required scalar fields.
  if (!Object.prototype.hasOwnProperty.call(proof, "cycle")) {
    drifts.push({ kind: "missing_field", field: "cycle" });
  } else if (!Number.isInteger(proof.cycle) || proof.cycle < 0) {
    drifts.push({ kind: "invalid_cycle", value: proof.cycle });
  }

  const tsField = proof.timestamp || proof.startedAt;
  if (!tsField) {
    drifts.push({ kind: "missing_field", field: "timestamp" });
  } else if (Number.isNaN(Date.parse(tsField))) {
    drifts.push({ kind: "invalid_timestamp", value: tsField });
  }

  if (!proof.trigger) {
    drifts.push({ kind: "missing_field", field: "trigger" });
  } else if (!isPlainObject(proof.trigger)) {
    drifts.push({ kind: "type_mismatch", field: "trigger", expected: "object", actual: typeName(proof.trigger) });
  }

  // filesChanged is required to be an array if present.
  if (proof.filesChanged !== undefined) {
    if (!Array.isArray(proof.filesChanged)) {
      drifts.push({
        kind: "type_mismatch",
        field: "filesChanged",
        expected: "array",
        actual: typeName(proof.filesChanged)
      });
    }
  }

  // actions vs filesChanged coherence.
  const acts = activityCount(proof);
  const files = Array.isArray(proof.filesChanged) ? proof.filesChanged.length : 0;
  if (acts > 0 && files === 0) {
    drifts.push({ kind: "actions_without_files", actions: acts });
  }
  if (files > 0 && acts === 0) {
    drifts.push({ kind: "files_without_actions", files });
  }

  // Signature integrity: both or neither.
  const hasSigner = typeof proof.signer === "string" && proof.signer.length > 0;
  const hasSignature = typeof proof.signature === "string" && proof.signature.length > 0;
  if (hasSignature && !hasSigner) {
    drifts.push({ kind: "signature_no_signer" });
  }
  if (hasSigner && !hasSignature) {
    drifts.push({ kind: "signer_no_signature" });
  }

  return { ok: drifts.length === 0, drifts };
}

function crossCheckClaims(proof) {
  const drifts = [];
  if (!isPlainObject(proof)) {
    return { ok: false, drifts: [{ kind: "non_object_root" }] };
  }
  const files = Array.isArray(proof.filesChanged) ? proof.filesChanged : [];
  const touchedState = files.some((f) => typeof f === "string" && /memory\/state\.json$/.test(f));
  const acts = activityCount(proof);
  const decisions = Array.isArray(proof.decisions) ? proof.decisions.length : 0;
  if (touchedState && acts === 0 && decisions === 0) {
    // state.json should never change without at least one decision or action.
    drifts.push({ kind: "state_change_no_record" });
  }
  return { ok: drifts.length === 0, drifts };
}

function buildReplayReport(proof) {
  const replay = replayCycleProof(proof);
  const cross = crossCheckClaims(proof);
  const drifts = [...replay.drifts, ...cross.drifts];
  return {
    ok: drifts.length === 0,
    cycle: isPlainObject(proof) && Number.isInteger(proof.cycle) ? proof.cycle : null,
    timestamp: isPlainObject(proof) ? (proof.timestamp || proof.startedAt || null) : null,
    drifts
  };
}

module.exports = {
  buildReplayReport,
  crossCheckClaims,
  replayCycleProof
};
