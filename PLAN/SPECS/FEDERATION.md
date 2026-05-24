# Inter-Orbit Federation Protocol — Spec (v1)

**Session:** S-021 / S-022 / S-023
**Phase:** 3 — Token Utility + Federation
**Status:** SPEC + PARSE-ONLY STUB
**Owner:** Orbit core
**Supersedes:** none

> This document specifies the wire protocol, transport, quarantine pipeline, and trust model for inter-Orbit federation. The companion stub lives at `src/agent/federation.js` and implements parsing + verification only. **No outbound network is wired in S-022; that happens in S-026 / S-027 once Phase 3 sessions clear S-GATE-2.**

---

## 1. Goal

Federation lets independent Orbit instances — each one running in its own GitHub repo, with its own signing key, its own treasury, its own approval flow — exchange short, signed messages that share intel the broader Orbit network benefits from.

Concrete examples this v1 must enable:

- **Dependency advisories.** Orbit A notices a security advisory landed for `clanker-sdk@4.2.16` (its own pinned version). It emits an `INTEL_SHARE` with `{kind: "advisory", subject: "clanker-sdk@4.2.16", source: "https://github.com/.../advisory/GHSA-xxxx"}`. Orbit B, which depends on the same package, ingests, dedupes, scores risk, and surfaces it as a flagged learning for its owner.
- **Scam contract sightings.** Orbit A's `scanTextRisk` flags a `0x...` contract address in a hostile issue. It emits an `INTEL_SHARE` `{kind: "scam_address", subject: "0xdeadbeef..."}`. Orbit B sees the same address show up in a comment two cycles later and refuses to engage with it without owner confirmation, citing the federation source.
- **Capability discovery.** Orbit A advertises `CAPABILITY_ADVERTISE` `{capability: "audit-solidity", since: cycle 412}`. Phase 4's bounty referral will read this to know which Orbits can be referred for which work.

Federation buys the network a one-hop epistemic layer: facts that one Orbit verified locally can propagate with proof (signed by an identifiable key, rooted in an identifiable repo) to other Orbits, without any centralized server or new infrastructure dependency.

## 2. Constraints

- **GitHub-only.** No new hosted service, no centralized message bus, no AWS/Vercel/Netlify dependency. Transport is files in repos read via `raw.githubusercontent.com`. This is non-negotiable per the project's github-only infrastructure decision.
- **No new npm dependency.** Use `node:crypto` and the already-installed `viem` (used by `proof-signing.js`).
- **No PII leakage.** Messages MUST NOT include issue authors, commit authors, repo private members, or any identifier scoped to a single human. Subjects are package names, contract addresses, public CVE IDs.
- **Outbound is approval-gated.** Even sending HELLO requires both an env flag (D-018-style hard gate) and a verified pre-launch state.
- **Inbound is quarantined.** No handler acts on a message until it survives every step of the quarantine pipeline (§5).
- **No replays.** Every accepted nonce is recorded permanently in the inbox ledger.

## 3. Message Types (v1)

All messages share a common envelope:

```
{
  "version": "1",
  "type":    "HELLO" | "INTEL_SHARE" | "CAPABILITY_ADVERTISE",
  "fromRepo":   "owner/repo",            // GitHub coordinate of sender
  "fromSigner": "0x...",                 // checksummed EVM address (D-006 signer)
  "sentAt":     "2026-05-24T12:34:56Z",  // ISO-8601 UTC
  "nonce":      "<hex/uuid>",            // unique per (fromRepo, fromSigner)
  "payload":    { ... },                 // type-specific
  "signature":  "0x...132 hex chars..."  // EIP-712 over canonicalEnvelope(envelope_minus_signature)
}
```

### 3.1 `HELLO`

> "This Orbit instance exists, at this repo, with this signer, starting at this cycle."

```json
{
  "payload": {
    "agentName": "Orbit",
    "cycle": 412,
    "capabilities": ["audit-solidity", "issue-triage"],
    "publicReceiptsUrl": "https://raw.githubusercontent.com/owner/repo/main/runtime/proofs/",
    "text": "Hello from owner/repo at cycle 412."
  }
}
```

`HELLO` is the discovery primitive. Peers exchange HELLOs on first contact and re-emit one when their signer rotates or their capability set changes.

### 3.2 `INTEL_SHARE`

> "This fact was true at this time, in this Orbit's local view."

```json
{
  "payload": {
    "kind": "advisory" | "scam_address" | "dependency_update" | "incident",
    "subject": "clanker-sdk@4.2.16",
    "severity": "low" | "medium" | "high" | "critical",
    "evidenceUrl": "https://...",
    "expiresAt": "2026-06-24T00:00:00Z",
    "text": "Free-form description, scanned by scanTextRisk on receive."
  }
}
```

Recipients dedupe by `(kind, subject)` in addition to `nonce`. The `text` field is always run through `scanTextRisk` — `critical`-level text quarantines the message even if the signature is valid.

### 3.3 `CAPABILITY_ADVERTISE`

> "This Orbit knows how to do X, and has done it Y times."

```json
{
  "payload": {
    "capability": "audit-solidity",
    "since": 412,
    "successCount": 7,
    "text": "I have audited 7 Solidity contracts."
  }
}
```

Informational only in v1. Phase 4's bounty referral (S-026) reads it. **No tool dispatch is triggered by ingesting this type.**

## 4. Transport

### 4.1 Outbox

Each Orbit instance writes outbound messages to:

```
runtime/federation/outbox/{nonce}.json
```

Files are committed to the repo as part of the cycle that produced them. The path is intentionally inside `runtime/` so it ships with the repo state and is reproducible from git history alone.

### 4.2 Inbox pull

A receiving Orbit reads from a known list of peers' outboxes:

```
GET https://raw.githubusercontent.com/{peer.repo}/main/runtime/federation/outbox/
```

(Directory listing isn't directly available via raw.githubusercontent.com; in practice each peer also writes a `runtime/federation/outbox/index.json` listing recent nonces, which the puller fetches first.)

This MUST run inside a GitHub Action job — `fetch` to `raw.githubusercontent.com` is permitted by default and no new dependency is required.

**S-022 stub does NOT implement the pull.** It only implements parse + verify on a pre-fetched envelope object.

### 4.3 Peer subscription list

`memory/federation-peers.json`:

```json
{
  "peers": [
    {
      "repo": "owner/example",
      "signer": "0x...",
      "addedAt": "2026-05-24T12:00:00Z",
      "addedBy": "approval-issue#42",
      "status": "active" | "paused" | "evicted",
      "quarantineFails": 0,
      "messagesIngested": 0
    }
  ]
}
```

Peers are added by an approval issue (D-014 pattern), never by the agent itself. Eviction (status flip + reason) requires a follow-up approval issue OR an automatic eviction trigger (§8).

### 4.4 Inbox ledger

`memory/federation-inbox-ledger.json`:

```json
{
  "nonces": {
    "<nonce>": {
      "from": "owner/repo",
      "type": "INTEL_SHARE",
      "ingestedAt": "2026-05-24T12:34:56Z",
      "decision": "accepted" | "quarantined" | "dropped",
      "reason": "ok" | "<quarantine reason>"
    }
  }
}
```

The ledger is append-only at the protocol level — entries are never deleted, only superseded by a later cycle's note if the original decision is overridden by an approval flow.

### 4.5 Accepted inbox

`runtime/federation/inbox/{nonce}.json` — the envelope is moved here only after every quarantine check passes. Handlers (per type) read from this path.

## 5. Quarantine Pipeline

Every inbound message walks through every step. Failure at any step yields `accept: false` and a ledger entry with the reason. **S-022 stub implements steps a–d.** Steps e–g are spec'd here; their implementations belong to S-026 (cycle loop wiring) and beyond.

### Step a — Canonicalize envelope

`canonicalEnvelope(env)` produces a stable string by:

1. Stripping the `signature` field.
2. Recursively sorting object keys.
3. Reusing the same canonicalization rules as cycle proofs (`src/agent/proof-canonical.js` `canonicalize`).

This is the input both to envelope hashing and to signature verification.

### Step b — Verify signature

`verifyEnvelopeSignature(env)` recovers the signer address from the EIP-712 typed-data signature over the envelope. The typed-data domain reuses Orbit's signing domain (chainId 8453, version "1") but with `name: "Orbit Federation Envelope"`. The recovered address MUST match `env.fromSigner`. If not, the message is quarantined with `signature_mismatch`.

If `viem`'s `recoverTypedDataAddress` is available the stub uses it directly. If for any reason it is not, the stub falls back to a **structural-only** check (signature must be a 0x-prefixed 132-char hex string). The structural-only path is marked as a Phase 3 follow-up in code and is NEVER acceptable in production — it exists only to keep the stub testable in environments where viem couldn't load.

### Step c — Repo↔signer binding

The signer that signed the envelope MUST be the signer the sending repo publicly declares as its agent signer. In production this is fetched from:

```
https://raw.githubusercontent.com/{env.fromRepo}/main/memory/identity.json
```

…and the JSON's `agentSigner` field is compared against `env.fromSigner`. In the stub, we just assert both `fromRepo` and `fromSigner` are non-empty strings and `fromSigner` is well-formed (0x + 40 hex chars). This is sufficient at S-022; the fetch is wired in the cycle-loop session.

### Step d — Payload risk scan

`classifyPayload(env)` runs `scanTextRisk` (from `src/agent/scam.js`) over the payload's `text` field, plus a deterministic check for high-risk patterns the federation layer specifically blocks:

- Fake `gh_...` GitHub tokens (anything matching `/\bgh[a-z]_[A-Za-z0-9]{20,}/`) — auto-flag.
- "Send funds to `0x...`" patterns — auto-flag (a `0x` address PLUS one of: send|transfer|drain|withdraw|sweep|forward).
- "Buy this", "sell that" market manipulation language — auto-flag.

Any payload with risk level `critical` is quarantined. `high` is accepted but flagged in the ledger and handler. `medium` and `low` pass through.

### Step e — Dedupe (spec'd, NOT in stub handler — but stub exposes ledger I/O)

If `env.nonce` already exists in `memory/federation-inbox-ledger.json`, the second arrival is dropped with reason `replay`. `loadInboxLedger` / `saveInboxLedger` are provided in the stub.

### Step f — Persist accepted message

Write `runtime/federation/inbox/{nonce}.json`. Append ledger entry. Wire from cycle.

### Step g — Handler dispatch

Per-type handlers decide:

- `HELLO` → record peer health, no action.
- `INTEL_SHARE` → run through D-014 enforcement (§6). If safe-by-rule, record to `memory/learnings.json` and optionally surface to next cycle's context. Never auto-act on-chain.
- `CAPABILITY_ADVERTISE` → record to `memory/federation-capabilities.json`. Phase 4 bounty referral reads it.

## 6. D-014 Enforcement (No On-Chain Without Approval)

Federation MUST NOT cause an on-chain transaction without an approval issue. Enforcement:

- `INTEL_SHARE` payloads that include keywords like `buy`, `sell`, `send funds`, `withdraw`, `swap`, `bridge` get **autocategorized to a flagged learning** with severity raised by 20 points. They are NEVER auto-acted on, never auto-cast, never auto-routed to a tool.
- `CAPABILITY_ADVERTISE` is informational only. Phase 4 referral resolves the capability into a candidate peer, but the actual outbound bounty refer requires its own approval issue.

Implementation hook: `classifyPayload` returns `risky: true` whenever any of these patterns match, and `quarantineDecision` routes those to `accept: false` for the v1 stub.

## 7. D-018 Enforcement (Federation Disabled Until Pre-Launch Clean)

`isFederationEnabled(config, state)` returns `{ok: false, reason}` unless ALL are true:

1. `config.federation === true` OR `process.env.ORBIT_ENABLE_FEDERATION === "true"`.
2. `state.preLaunchVerified === true`.

Until both flip green, even outbound `HELLO` is dry-run only — the file would be written to `runtime/federation/outbox/dry/` and never committed. (Implementation of that dry-run path belongs to the cycle-loop session, not the stub.)

## 8. Anti-Abuse

| Threat | Mitigation |
|---|---|
| Replay | Nonce + dedupe ledger (`memory/federation-inbox-ledger.json`) |
| Spam | Per-peer rate limit: max 10 messages per cycle, max 50 per day. Excess → quarantined as `rate_limited`. |
| Imposter | `fromSigner` must match the peer's repo-declared signer (step c). |
| Hostile peer | `peer.quarantineFails` increments on every quarantine. Threshold 5 → status auto-flipped to `evicted`; subsequent messages dropped at the peer-status check before signature work. Re-add requires approval issue. |
| Encoded-payload smuggling | `scanTextRisk` flags `encoded_instruction_relay` → quarantined as `risky_payload`. |
| PII leak | Allowed payload fields enumerated above; everything else stripped before persisting. (Enforcement: a strict schema check in S-026's persistence path.) |

## 9. Test Plan

Implemented in `tests/federation.test.js`, ≥13 tests covering:

- Canonical envelope stability across key reorders.
- Envelope hash stability per envelope, differing per nonce.
- Signature rejection for malformed inputs (wrong length, missing `0x`, non-hex).
- Signature acceptance for a real EIP-712-signed envelope via viem (round trip).
- Payload classification flags `gh_...` token leaks.
- Payload classification flags EVM-address + "send funds" pattern.
- `quarantineDecision` rejects unknown type.
- `quarantineDecision` rejects when signature invalid.
- `quarantineDecision` rejects when payload is risky.
- `isFederationEnabled` requires the env flag.
- `isFederationEnabled` requires `state.preLaunchVerified`.
- Replay protection through `loadInboxLedger`/`saveInboxLedger` round trip (uses tmpdir, never touches `memory/`).
- Hostile-peer eviction: `status: "evicted"` causes messages to drop.

Tests MUST NOT make outbound network calls, MUST NOT write under the real `memory/` directory, and MUST use `node:fs` + `os.tmpdir()` for any I/O.

## 10. Future Work

- **S-026** — wire `sendMessage` + outbox commit into the cycle loop with full D-014/D-018 gating.
- **S-026** — bounty referral cross-repo via a new `BOUNTY_REFERRAL` message type.
- **S-023 follow-up** — on-chain registry of trusted peers (a single small contract on Base mapping `bytes32 repoHash -> address signer`) so peer subscriptions can be cryptographically anchored rather than file-based.
- **S-027** — Merkle-batched federation ingest so we anchor "Orbit B accepted these messages from Orbit A this day" on-chain alongside cycle proofs (D-012).
- **Phase 4** — multi-hop federation (peer-of-peer discovery) gated by reputation; out of scope here.
