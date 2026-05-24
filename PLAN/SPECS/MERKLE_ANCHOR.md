# MERKLE_ANCHOR — Daily Merkle anchor of Orbit cycle proofs

> Spec for S-015. Implements [D-012](../DECISIONS.md). Bound by [D-006](../DECISIONS.md),
> [D-014](../DECISIONS.md), and [D-018](../DECISIONS.md).

## 1. Goal

Per **D-012**, starting in Phase 2 (post-launch), Orbit computes a Merkle root
over the SHA-256 leaf hashes of every signed cycle proof produced in the
trailing 24 hours and posts that root on-chain to a minimal registry contract
on Base. The on-chain anchor turns the cycle-proof JSON files in
`runtime/proofs/` into a tamper-evident chain: modifying any historical proof
would break the corresponding root, which is visible on Basescan.

Pairs with **D-006** (every proof is already signed) and **D-014** (no on-chain
action without an approval issue + signed receipt). The off-chain math, the
proposal, and the approval gate all run inside the cycle. Only the final
`anchorRoot` transaction touches the chain, and only after the owner approves.

## 2. Components

- **Off-chain builder.** `src/agent/merkle-anchor.js` — pure functions for
  proof collection, leaf hashing, tree construction, root computation,
  inclusion proofs, ledger I/O, approval-gated proposal + execution.
- **Tool surface.** `propose_merkle_anchor` and `execute_merkle_anchor` in
  `src/agent/tools.js`. Both refuse unless `isAnchorEnabled` returns `ok`.
- **Handlers.** Two cases in `src/agent/actions.js` that call into
  `merkle-anchor.js` and emit sanitized receipt payloads (no leaf bodies leak).
- **Contract.** `packages/orbit-anchor/contracts/MerkleAnchor.sol` — minimal
  storage + emission layer. Owner-only `anchorRoot`. One-shot per `windowEnd`.
- **Ledger.** `memory/merkle-anchors.json` — append-only record of every
  proposal and execution, including dry-run rows. Schema below.

## 3. Off-chain algorithm

### 3.1 Leaf hash

For each cycle proof file under `runtime/proofs/<day>/<timestamp>.json`:

1. Parse the JSON.
2. Strip the signature envelope (`signature`, `signer`, `signedAt`,
   `signatureScheme`, `payloadHash`) using `stripSignatureEnvelope` from
   `proof-canonical.js`. The leaf is over the *content*, not the *signature*;
   re-signing the same content yields the same leaf.
3. Canonicalize with `canonicalize` from `proof-canonical.js` (deterministic
   key-sorted JSON, identical to the one used for the signed payload hash).
4. `leaf = sha256(canonical bytes)`, hex-encoded with `0x` prefix.

**Algorithm: SHA-256.** Rationale:
- SHA-256 is in Node's built-in `crypto` — no new dependency, no `viem`
  detour for this off-chain hash.
- Cycle proofs themselves use Keccak-256 inside the EIP-712 signature
  payload hash. We deliberately keep the *anchor* leaf separate from that
  payload hash so the anchor is independent and can be checked without
  recomputing EIP-712.
- 32-byte digest matches `bytes32` in Solidity exactly.

### 3.2 Pair hashing

Sorted-concatenation, then SHA-256:

```
pair(a, b) = sha256( min(a,b) || max(a,b) )
```

Sorting at the pair step means the inclusion proof does **not** need a
"left/right" position field — verification re-sorts, so a stored position
field can't be made adversarial. (We still emit a position annotation in
`generateProof` for human-debuggable output; `verifyProof` ignores it.)

### 3.3 Tree construction

- `n == 0` -> root is `ZERO_ROOT = 0x000...000`. Used when the window is empty.
- `n == 1` -> root is the single leaf itself (no hashing).
- `n >= 2` -> layered build. At each layer with an odd node count, the last
  node pairs with itself.

### 3.4 Window collection

`collectProofs(repoRoot, windowHours, now)`:

1. List every `runtime/proofs/<day>/*.json` file.
2. Parse the timestamp from the filename (the run.js writer uses
   `YYYY-MM-DDTHH-MM-SS-mmmZ.json` format, which round-trips to a real Date).
3. Keep files whose timestamp is in `(now - windowHours*3600s, now]`.
4. Compute the leaf hash for each, sort by ascending timestamp, return
   `[{ cycle, hash, signedProofPath, finishedAt, timestamp }]`.

Filename-based windowing avoids re-reading file mtime (which can drift on
restore from git or CI) and ties the window to the proof's own clock.

## 4. Window semantics

`windowEndIso` is the ISO 8601 instant marking the *end* of the window. The
window itself is `(windowEndIso - windowHours, windowEndIso]`.

Defaults:
- `windowEndIso` -> current ISO time if the caller does not supply one.
- `windowHours` -> `ORBIT_ANCHOR_WINDOW_HOURS` (default 24).

`anchorIdempotencyKey(windowEndIso)` is the first 32 hex chars of
`sha256("orbit-merkle-anchor:" + windowEndIso)`. Stable per `windowEndIso`,
which means re-proposing for the same instant returns the same ledger entry.

On chain, the contract keys the storage map by `uint64 windowEnd` in unix
seconds. Choosing the unix-seconds slot is the agent's responsibility; for
the daily flow we expect `windowEndIso` to land on `T00:00:00Z` so the slot is
the unix midnight of the next UTC day.

## 5. Approval flow (D-014)

1. **Propose.** `proposeAnchor` is called with `windowEndIso` (optional) and a
   short `rationale` (<=240 chars). It:
   - Refuses if the gate fails (`isAnchorEnabled`).
   - Collects the window, computes the root, builds the ledger entry.
   - Creates a public GitHub issue with labels `orbit:approval` and
     `orbit:merkle-anchor` containing the idem key, root, leaf count,
     window end, mode (`DRY_RUN`/`LIVE`), and the exact approval comment
     string the owner must reply with.
   - Writes a pending ledger entry with `status: "proposed_dry"` or
     `"proposed"`.
2. **Owner reviews.** Owner inspects the issue, optionally re-runs the
   off-chain build against `runtime/proofs/` (purely deterministic — they
   should arrive at the same root), labels the issue `orbit:approved`, and
   posts a comment containing the exact line
   `APPROVE ORBIT-MERKLE-ANCHOR <idem>`.
3. **Execute.** `executeAnchor` is called with the `proposalIssueNumber`.
   It re-checks:
   - The gate still passes.
   - The proposal issue exists, carries `orbit:approved`, and contains the
     exact APPROVE comment from the configured owner.
   - The ledger entry exists and matches the issue number.

   In `DRY_RUN` it writes a synthetic txHash (`0xanc<idem>...0`) and sets
   `status: "executed_dry"`. In `LIVE` it currently refuses with
   `status: "blocked_live_unavailable"` because the wallet helper for
   `sendAnchorTransaction` does not yet exist (deliberate D-018 backstop).

A `REJECT ORBIT-MERKLE-ANCHOR <idem>` comment from the owner sets the entry
to `status: "rejected"`.

## 6. Failure modes

- **Empty window.** `leafCount == 0` and `root == ZERO_ROOT`. The agent still
  proposes (so the cadence stays auditable) but `executeAnchor` skips the
  on-chain write — the contract refuses `bytes32(0)` via `ZeroRoot`. The
  ledger row remains at `status: "proposed_dry"` (or `"proposed"`) and the
  next non-empty window picks up regardless.
- **No contract address.** `isAnchorEnabled` refuses both propose and
  execute. We can still cut a fresh ledger row by proposing in dry-run after
  setting `ORBIT_ANCHOR_DRY_RUN=true` and leaving the contract address blank
  — those proposals are spec-only and do not touch the chain.
- **Transaction revert.** If the future live path is wired and the on-chain
  call reverts (most likely cause: someone already anchored the same
  `windowEnd`), the ledger entry is set to `status: "failed"` with a
  `reason`. The same leaves are eligible for inclusion in the next window's
  root, which means a revert is recoverable without manual surgery.
- **Approval missing.** `executeAnchor` sets the entry to
  `status: "pending_approval"` and reports `blocked: true`. The agent does
  not retry on its own; the owner has to label + comment.
- **Owner rejection.** Entry transitions to `status: "rejected"`.

## 7. Idempotency

- Off-chain: keyed by `windowEndIso`. Re-proposing the same instant returns
  the existing ledger row.
- On-chain: keyed by `uint64 windowEnd`. The contract reverts with
  `AlreadyAnchored` on the second write, which is the property D-012 promises.

These two layers are aligned by the cycle engine's choice of `windowEndIso`.
The cycle is expected to anchor exactly one window per UTC day.

## 8. D-018 enforcement

`isAnchorEnabled` refuses unless `state.preLaunchVerified === true`. Until
the 12-hour clean run is signed off in `memory/state.json`, every propose
returns `status: "blocked_precondition"` and every execute does the same.
This is in addition to the live-transaction backstop in `executeAnchor`,
which refuses unconditionally while `wallet.sendAnchorTransaction` is
unwired — even if the gate is somehow flipped open.

## 9. Ledger schema

`memory/merkle-anchors.json`:

```
{
  "anchors": [
    {
      "idem": "32-hex-chars",
      "windowEndIso": "2026-07-01T00:00:00.000Z",
      "windowHours": 24,
      "root": "0x...",
      "leafCount": 47,
      "rationale": "first daily anchor of phase 2",
      "dryRun": true,
      "approved": false,
      "proposalIssueUrl": "https://github.com/<org>/orbit/issues/123",
      "proposalIssueNumber": 123,
      "txHash": "0xancabc...000",
      "status": "executed_dry",
      "at": "2026-07-01T00:01:14.221Z",
      "approvedAt": "2026-07-01T00:05:01.000Z",
      "executedAt": "2026-07-01T00:05:14.444Z",
      "lastCheckedAt": null
    }
  ]
}
```

Status values: `proposed`, `proposed_dry`, `proposed_existing`,
`pending_approval`, `rejected`, `executed_dry`,
`blocked_live_unavailable`, `failed`.

## 10. Receipt fields

Both handlers attach only sanitized fields to the proof:

```
{
  "kind": "merkle_anchor",
  "action": "propose" | "execute",
  "ok": true,
  "dryRun": true,
  "blocked": false,
  "root": "0x...",
  "leafCount": 47,
  "txHash": "0xanc...000",
  "proposalIssueUrl": "...",
  "proposalIssueNumber": 123,
  "idem": "...",
  "status": "...",
  "reason": null
}
```

No leaf bodies, no proof file paths, no signature material. Anyone who wants
to audit can re-run the off-chain build against the public `runtime/proofs/`
directory.

## 11. Test plan pointers

See `tests/merkle-anchor.test.js` (>=12 tests, `node --test`):

- Leaf hash determinism on canonical proofs.
- Tree construction over 3-, 4-, and 5-leaf inputs against hand-derived roots.
- `verifyProof` accepts valid proofs and rejects tampered ones.
- `computeMerkleRoot([])` returns `ZERO_ROOT`.
- `collectProofs` filters by window using filename timestamps.
- `anchorIdempotencyKey` is stable per `windowEndIso`.
- `isAnchorEnabled` refuses when disabled, when `preLaunchVerified !== true`,
  and when no contract address is set.
- `proposeAnchor` writes a ledger entry in dry-run without network access.
- `executeAnchor` returns a synthetic txHash in dry-run.
- `executeAnchor` blocks when the approval label is missing.
- Handler responses contain only sanitized fields.

## 12. Open follow-ups

- **Wallet wiring.** `wallet.sendAnchorTransaction(contract, windowEnd, root, leafCount)`
  is the missing piece for live execution. It belongs in the wallet helper
  that already gates buyback live execution (S-014).
- **Verifier extension.** The off-chain verifier (`@orbit-house/verifier`)
  should grow a mode that pulls all proofs for a given window, recomputes
  the root locally, and compares against `rootForWindow(windowEnd)` on Base.
- **Dashboard tile.** `orbit.horse` should surface the most recent anchored
  window + on-chain link to the `RootAnchored` event.
