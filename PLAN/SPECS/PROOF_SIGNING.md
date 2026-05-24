# PROOF_SIGNING.md — Wallet-Signed Cycle Proofs (S-002)

> Implementation spec for D-006. Owner reads this and implements in S-002. Every cycle proof becomes a cryptographic receipt verifiable from outside the repo.

## 1. Signing scheme decision: EIP-712 typed data

**Choice: EIP-712 (`signTypedData`), not `eth_signMessage`.**

Rationale:
- `eth_signMessage` would hash a JSON string. Any whitespace, key-order, or escaping drift across Node versions silently breaks verification. Owners debugging a failed verify see only "signature mismatch" with no field-level clue.
- EIP-712 commits to a typed struct, so we can hash exactly the fields that matter (cycle, timestamps, digest of the steps blob) and freely add cosmetic fields (`firstWakeIntro`, log lines) to the proof file without invalidating the signature.
- Wallets and verifiers (MetaMask, Etherscan "Verify Signature", Safe) render EIP-712 payloads field-by-field. Useful when an owner wants to manually re-sign a recovery proof.
- viem's `signTypedData` / `verifyTypedData` / `recoverTypedDataAddress` are stable and have no `keccak256("\x19Ethereum Signed Message:\n…")` ambiguity.

Typed data:

```js
const domain = {
  name: "Orbit Cycle Proof",
  version: "1",
  chainId: 8453,               // Base mainnet, matches the wallet's home chain
  // No verifyingContract — proofs are off-chain receipts, not contract calls.
};

const types = {
  CycleProof: [
    { name: "brand",      type: "string"  },
    { name: "cycle",      type: "uint256" },
    { name: "startedAt",  type: "string"  }, // ISO-8601, exact bytes from proof
    { name: "finishedAt", type: "string"  },
    { name: "trigger",    type: "string"  }, // canonical trigger.type + ":" + trigger.id
    { name: "dryRun",     type: "bool"    },
    { name: "totalSteps", type: "uint256" },
    { name: "payloadHash",type: "bytes32" }  // keccak256 of canonical body (see §2)
  ]
};
```

`payloadHash` is what binds the actual content. The other fields are denormalized for human-readable wallet rendering.

## 2. Canonical JSON form

Use RFC 8785 JCS — minimal implementation, ~60 LOC, no dep. Implement once in `src/agent/proof-canonical.js`:

- Recursively sort object keys lexicographically (UTF-16 code-unit order, matches `Array.prototype.sort` default).
- Arrays preserve order.
- `JSON.stringify` with `null` replacer and no spacing.
- Numbers: JSON's default. Reject non-finite.
- Strings: standard JSON escaping.
- Strip these fields before hashing (they live outside the signed envelope):
  - `signature`, `signer`, `signedAt`, `signatureScheme`, `payloadHash`

Algorithm:

```js
function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

function payloadHash(proof) {
  const body = { ...proof };
  for (const k of ["signature","signer","signedAt","signatureScheme","payloadHash"]) delete body[k];
  return keccak256(toBytes(canonicalize(body)));  // viem: keccak256, toBytes
}
```

## 3. Proof file shape

**Before** (current production format — abbreviated):

```json
{
  "brand": "Orbit",
  "cycle": 21,
  "startedAt": "2026-05-23T04:07:34.518Z",
  "finishedAt": "2026-05-23T04:07:35.378Z",
  "trigger": { "type": "mandatory", "id": "regular_heartbeat" },
  "dryRun": false,
  "steps": [],
  "filesChanged": [],
  "totalSteps": 4,
  "result": "..."
}
```

**After** (additive — five new fields, nothing removed):

```json
{
  "brand": "Orbit",
  "cycle": 21,
  "startedAt": "2026-05-23T04:07:34.518Z",
  "finishedAt": "2026-05-23T04:07:35.378Z",
  "trigger": { },
  "dryRun": false,
  "steps": [],
  "filesChanged": [],
  "totalSteps": 4,
  "result": "...",

  "signatureScheme": "eip712:orbit-cycle-proof/1",
  "payloadHash": "0x9f1c…",
  "signature": "0x…65 bytes…",
  "signer": "0xAbc…",
  "signedAt": "2026-05-23T04:07:35.379Z"
}
```

`signatureScheme` is versioned so future migrations (e.g., `eip712:orbit-cycle-proof/2`) coexist with old proofs.

## 4. Code touchpoints

### 4.1 New file: `src/agent/proof-signing.js` (~80 LOC)

```js
const { keccak256, toBytes } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { canonicalize } = require("./proof-canonical");

const SCHEME = "eip712:orbit-cycle-proof/1";
const DOMAIN = { name: "Orbit Cycle Proof", version: "1", chainId: 8453 };
const TYPES = { CycleProof: [ /* see §1 */ ] };

function buildTypedMessage(proof, payloadHashHex) {
  return {
    brand: String(proof.brand || ""),
    cycle: BigInt(proof.cycle || 0),
    startedAt: String(proof.startedAt || ""),
    finishedAt: String(proof.finishedAt || ""),
    trigger: `${proof.trigger?.type || ""}:${proof.trigger?.id || ""}`,
    dryRun: Boolean(proof.dryRun),
    totalSteps: BigInt(proof.totalSteps || 0),
    payloadHash: payloadHashHex
  };
}

async function signProof(proof, privateKey) {
  const account = privateKeyToAccount(privateKey);
  const payloadHashHex = keccak256(toBytes(canonicalize(stripSigFields(proof))));
  const message = buildTypedMessage(proof, payloadHashHex);
  const signature = await account.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: "CycleProof", message });
  return {
    signatureScheme: SCHEME,
    payloadHash: payloadHashHex,
    signature,
    signer: account.address,
    signedAt: new Date().toISOString()
  };
}

async function recoverSigner(proof) { /* uses recoverTypedDataAddress */ }
async function verifyProof(proof, expectedSigner = null) { /* returns { signed, verified, recovered, reason } */ }
async function assertSignerMatches(privateKey, expectedSigner) { /* cycle start check */ }

module.exports = { SCHEME, DOMAIN, TYPES, signProof, recoverSigner, verifyProof, assertSignerMatches, buildTypedMessage };
```

### 4.2 `src/agent/config.js` — add field

Add: `agentSigner: env.ORBIT_AGENT_SIGNER || "",`

### 4.3 `src/agent/run.js` — diff sketch

- Top of `main()`, after `loadConfig()` and before any work:
  ```js
  if (config.walletPrivateKey && config.agentSigner) {
    await assertSignerMatches(config.walletPrivateKey, config.agentSigner);
  } else if (config.agentSigner && !config.walletPrivateKey) {
    throw new Error("ORBIT_AGENT_SIGNER set but ORBIT_WALLET_PRIVATE_KEY missing");
  }
  ```
- Right before `writeJson(... proofPath, proof)`:
  ```js
  if (config.walletPrivateKey && config.agentSigner) {
    Object.assign(proof, await signProof(proof, config.walletPrivateKey));
  }
  ```

### 4.4 `src/agent/safety.js` — no change needed

`ORBIT_AGENT_SIGNER` is a public address; do NOT add it to `SECRET_PATTERNS`.

### 4.5 `packages/orbit-sdk/index.js` — extend `readReceipts`

Inject `{ signed, verified, signer, signatureScheme }` into each receipt object. Keep existing `digest: stableHash(proof)` unchanged. Make `readReceipts` async (only two callers exist — both already awaitable).

## 5. Verifier package — `packages/orbit-verifier/`

```
packages/orbit-verifier/
├── package.json
├── index.js          # programmatic API
├── cli.js            # bin entry
├── canonical.js      # copy of proof-canonical.js (no deps)
└── README.md
```

### `package.json`

```json
{
  "name": "@orbit-house/verifier",
  "version": "0.1.0",
  "description": "Verify Orbit cycle proof signatures. Pure Node + viem.",
  "main": "index.js",
  "bin": { "orbit-verify": "./cli.js" },
  "dependencies": { "viem": "^2.50.4" },
  "license": "MIT",
  "engines": { "node": ">=20" }
}
```

### `cli.js`

```js
#!/usr/bin/env node
"use strict";
const fs = require("fs");
const { verifyProofFile } = require("./index");

const EXIT = { OK: 0, INVALID: 1, UNSIGNED: 2, USAGE: 3, IO: 4 };

async function main(argv) {
  const args = argv.slice(2);
  let expectedSigner = null;
  let jsonOut = false;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") { printHelp(); return EXIT.OK; }
    if (a === "--signer") { expectedSigner = args[++i]; continue; }
    if (a === "--json") { jsonOut = true; continue; }
    if (a.startsWith("--")) { console.error(`unknown flag: ${a}`); return EXIT.USAGE; }
    files.push(a);
  }
  if (!files.length) { printHelp(); return EXIT.USAGE; }

  let worstExit = EXIT.OK;
  for (const file of files) {
    let proof;
    try { proof = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (e) { console.error(`${file}: ${e.message}`); worstExit = EXIT.IO; continue; }
    const result = await verifyProofFile(proof, { expectedSigner });
    if (jsonOut) console.log(JSON.stringify({ file, ...result }));
    else console.log(`${file}: ${result.verified ? "OK" : (result.signed ? "INVALID" : "UNSIGNED")}  signer=${result.signer || "-"}  recovered=${result.recovered || "-"}`);
    if (!result.signed) worstExit = Math.max(worstExit, EXIT.UNSIGNED);
    else if (!result.verified) worstExit = Math.max(worstExit, EXIT.INVALID);
  }
  return worstExit;
}

main(process.argv).then(c => process.exit(c)).catch(e => { console.error(e.stack || e.message); process.exit(EXIT.IO); });
```

Exit codes: 0=all verified, 1=at least one invalid signature, 2=at least one unsigned, 3=usage error, 4=I/O / parse error.

### `index.js`

Mirrors `src/agent/proof-signing.js` but verify-only. Exports `verifyProofFile(proof, { expectedSigner })` returning `{ signed, verified, signer, recovered, signatureScheme, payloadHash, reason }`.

## 6. Test plan — `tests/proof-signing.test.js`

1. **Round trip** — sign with fixed test key, recover, assert match.
2. **Canonical determinism** — shuffled-key inputs → identical payloadHash.
3. **Wrong key rejection** — sign with A, claim signer = address(B), verify fails with `recovered_address_mismatch`.
4. **Tampered payload** — mutate `proof.result` post-signing → fails with `payload_hash_mismatch`.
5. **Tampered envelope** — mutate `proof.cycle` post-signing → fails (cycle is in typed message).
6. **Missing signature** — proof lacks `signature` → `{ signed: false, verified: false }`, no throw.
7. **Future scheme** — `signatureScheme: "...v2"` → `{ signed: true, verified: false, reason: "unknown_scheme" }`.
8. **Cycle start check** — `assertSignerMatches(keyA, addressB)` throws; `(keyA, addressA)` resolves.
9. **SDK backwards compat** — fixture with mixed signed/unsigned, `readReceipts` returns both correctly tagged.

Verifier CLI tests: exit codes 0/1/2/3/4 via `execFileSync` in `tests/orbit-verifier.test.js`.

## 7. Failure modes

1. **`ORBIT_AGENT_SIGNER` unset, key set** — cycle proceeds unsigned (rollout phase). Log warning. After launch, gate via `config.requireSignedProofs`.
2. **Key/signer mismatch at start** — `assertSignerMatches` throws before any work; outer `.catch` in run.js exits 1.
3. **viem version drift** — pin `"viem": "^2.50.4"` in both `package.json` and verifier `package.json`. Golden-signature test catches accidental upgrade.
4. **Large proof memory** — guard in `signProof`: refuse if canonical body > 2 MB, throw and let run.js record `signError`.
5. **Future scheme migration** — verifier dispatches on `signatureScheme`; unknown → returns `verified:false, reason:"unknown_scheme"` (no throw).
6. **Clock skew on signedAt** — verifier must NOT validate against wall clock.
7. **Address case** — lowercase for compare; store checksummed in `signer`.

## 8. Migration path

- Existing unsigned proofs stay readable. SDK returns them with `{ signed: false, verified: false }`. No history rewriting.
- First signed cycle = first cycle with both env vars set. Record `firstSignedCycle: <N>` in `memory/state.json`.
- CLI `orbit-sdk receipts` (existing) gains `[signed]`/`[unsigned]`/`[invalid]` tag in non-JSON mode.
- Publish `signer` address in `memory/identity.md` so external verifiers can `npx @orbit-house/verifier --signer 0x… proof.json`.
- If key rotates, owner updates `ORBIT_AGENT_SIGNER` repo var in same commit as secret. Cycle-start check catches typos.

## Critical files to touch

- `src/agent/run.js` — main hook
- `src/agent/config.js` — new field
- `src/agent/proof-signing.js` — NEW
- `src/agent/proof-canonical.js` — NEW
- `packages/orbit-sdk/index.js` — extend readReceipts
- `packages/orbit-verifier/*` — NEW package
- `.github/workflows/orbit-cycle.yml` — already has `ORBIT_WALLET_PRIVATE_KEY`; add `ORBIT_AGENT_SIGNER` env line
- `tests/proof-signing.test.js` — NEW
- `tests/orbit-verifier.test.js` — NEW
