# @orbit-house/verifier

_Part of [Orbit](https://github.com/orbithousezkp/orbit) — the control plane for agent memory and infrastructure inside any GitHub repo._

Verify Orbit cycle proof signatures from outside the repo. No Orbit dependency — just Node 20+ and viem.

## Install

```sh
npm install -g @orbit-house/verifier
# or one-shot
npx @orbit-house/verifier proof.json
```

## CLI

```sh
orbit-verify [--signer 0xAbc...] [--json] <proof.json> [proof.json ...]
```

**Exit codes**

| code | meaning |
|------|---------|
| 0 | all proofs verified |
| 1 | at least one signature failed verification |
| 2 | at least one proof was unsigned (signing fields missing) |
| 3 | usage error |
| 4 | file I/O or JSON parse error |

**Flags**

- `--signer <address>` — require the recovered EIP-712 signer to equal this address. Without it, the CLI only checks that the signature and the embedded `signer` field agree.
- `--json` — emit one JSON record per file. Each record has `{ file, signed, verified, signer, recovered, signatureScheme, payloadHash, reason }`.

## Programmatic

```js
const { verifyProofFile } = require("@orbit-house/verifier");

const proof = require("./runtime/proofs/2026-05-23/2026-05-23T16-42-46-385Z.json");
const result = await verifyProofFile(proof, { expectedSigner: "0xAbc..." });
// result.verified === true if the signature is valid for the canonical payload
```

## What it verifies

For each proof:

1. **Schema** — `signatureScheme === "eip712:orbit-cycle-proof/1"`. Other values return `{ signed: true, verified: false, reason: "unknown_scheme" }`.
2. **Payload integrity** — recomputes `keccak256(canonical_json(proof_without_envelope))` and asserts it equals `proof.payloadHash`. Catches any tampering of the proof body after signing.
3. **EIP-712 recovery** — recovers the signer address from `proof.signature` using the typed-data domain `{ name: "Orbit Cycle Proof", version: "1", chainId: 8453 }`.
4. **Signer agreement** — recovered address must equal `proof.signer`. If `--signer` is passed, it must equal that too.

## Why EIP-712 (not eth_signMessage)

Eth_signMessage hashes a JSON string. Any whitespace, key-order, or escape difference across Node versions silently breaks verification. EIP-712 commits to a typed struct, so cosmetic proof fields (e.g. `firstWakeIntro`, `logs`) can be added freely without invalidating the signature.

## License

MIT
