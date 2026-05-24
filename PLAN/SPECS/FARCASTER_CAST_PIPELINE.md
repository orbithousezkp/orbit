# FARCASTER_CAST_PIPELINE.md — Cast Pipeline (S-004)

> Spec for S-004. The Farcaster cast pipeline closes every successful Orbit cycle with a terse, in-voice post linking to that cycle's signed receipt. In-cycle (D-008), in Orbit's own account (D-010), never blocking a cycle on cast failure.

## 1. API choice — Neynar, not Hub-direct

**Pick: Neynar managed signer + `POST /v2/farcaster/cast`.**

Hub-direct casting requires running/maintaining a Snapchain/Hub node, generating Ed25519 keys via the on-chain KeyGateway on OP Mainnet, paying storage rent in ETH, and signing FID messages locally. None of that fits a 30-min GitHub Actions worker that wakes cold each cycle.

Neynar wraps it: managed signer (UUID stays on our side, key custody is theirs), HTTPS endpoint, simple `x-api-key + signer_uuid` auth, native `idem` idempotency, embed support. Free tier sufficient for 48 casts/day + headroom.

Per-protocol limits stay: short cast 0–320 bytes, LONG_CAST 321–1024 bytes, embeds capped at 2, each ≤256 bytes. We always emit short casts; fall back to LONG_CAST only if stats push routine over 320.

Mini Apps (Frames v2) deferred to Phase 2 — requires hosted manifest at `/.well-known/farcaster.json` signed by Orbit's custody address. Plain URL embeds to orbit.horse for launch.

Sources: Neynar docs (`docs.neynar.com/reference/publish-cast`, `docs.neynar.com/reference/create-signer`), Farcaster protocol SPECIFICATION.md, Neynar pricing page.

## 2. Module structure — `src/agent/farcaster.js`

Pure functions, no I/O at import time. Network via native fetch. Exports:

```js
function pickTemplate(cycleSummary)           // -> { kind, data }
function renderCast(template, data)           // -> { text, embeds: [{url}] }
function scanOutbound(text)                   // -> { safe, reason?, redacted }
async function publishCast(config, text, options) // -> { ok, hash?, dryRun?, error?, blocked? }
function recordCastReceipt(proof, castResult) // mutate proof.cast
function loadCastLedger(repoRoot)             // -> Map<cycleId, {hash,castedAt}>
function saveCastLedger(repoRoot, ledger)     // -> path
function castIdempotencyKey(cycle, finishedAt) // -> string
```

`cycleSummary` is assembled in `run.js` from the in-progress `proof` object. `farcaster.js` imports only `safety` and `scam` for outbound scanning.

Constants: `NEYNAR_CAST_URL = "https://api.neynar.com/v2/farcaster/cast"`. Headers: `Content-Type: application/json`, `x-api-key: <ORBIT_FARCASTER_NEYNAR_API_KEY>`. Body: `{ signer_uuid, text, embeds, idem }`. Timeout 10s via `AbortSignal.timeout(10_000)`. One retry on network error or HTTP 5xx (back-off 1.5s), no retry on 4xx.

## 3. Cast templates (mapped to BRAND.md)

`pickTemplate` walks `cycleSummary` in priority order. Higher beats lower. All render to short cast (≤320 bytes); `renderCast` truncates bullets to fit.

| Template `kind` | Triggered when | Rendered cast |
|---|---|---|
| `mistake` | `cycleSummary.mistakeAcknowledgment` set | `cycle #{n} · correction\n\nearlier call on {targetRef} was wrong. reverted, logged.\n\nreceipt: {receiptUrl}` |
| `buyback` | `cycleSummary.buybackTxHash` set (Phase 2+) | `treasury {wethAmount} WETH this week\napproved: {approvalUrl}\nbought back: {orbitAmount} $ORBIT at ${price}\ntx: {basescanUrl}\n\nreceipt: {receiptUrl}` |
| `milestone` | cycle = 1, 10, 100, 1000, 10000, or stat threshold | `cycle #{n}\n{notableStat}\n\nreceipt: {receiptUrl}` |
| `approval-pending` | any step produced a new approval issue | `asking permission to {purpose}\nissue: {approvalIssueUrl}\ncost: {amountLabel}\nwill wait\n\nreceipt: {receiptUrl}` |
| `refusal` | any step's risk.level ≥ high and refused | `refused: {oneLineSummary}\nwhy: {category}\nlogged: {receiptUrl}` |
| `routine` (default) | none of above | `cycle #{n} · {triggerLabel}\n\n· {bullet1}\n· {bullet2}\n· {bullet3}\n\n${aiUsd} AI · {refusedCount} refused · {pendingCount} pending\n\nreceipt: {receiptUrl}` |

`receiptUrl = ${config.publicBaseUrl || 'https://orbit.horse'}/receipts/${proof.cycle}`. When `publicBaseUrl` unset, embed #2 is the raw GitHub blob URL.

Bullets are deterministic — tool name → phrase mapping (`comment_issue` → "replied to issue #N"; `append_memory` → "logged knowledge: {title}"; `propose_spend` → "proposed spend, gated"). Agent never writes bullet text directly.

## 4. Cycle integration — `run.js` call site

Cast at the **end** of `main()`, after `writeJson(... proof)` and `appendLine(... cycles.jsonl)`, **before** `commitIfNeeded`. Receipt JSON must exist before cast references it. Cast result is appended to proof and file is rewritten so the proof itself records the cast hash.

```js
const cycleSummary = summarizeCycleForCast(proof, context, config);
const cast = await postCycleCast(config, cycleSummary, proof);
proof.cast = cast;
writeJson(config.repoRoot, proofPath, proof);  // overwrite with cast result
```

`postCycleCast` lives in `farcaster.js`. Loads ledger, computes `idem`, short-circuits if cycle already cast, else `pickTemplate` → `renderCast` → `scanOutbound` → `publishCast` → persist to ledger. Every error caught and returned; nothing throws.

No tool-call casting on the autonomous step path. The cast happens deterministically in `main()`.

## 5. Tool entry — `cast_to_farcaster` in `tools.js`

```js
{
  name: "cast_to_farcaster",
  description: "Post Orbit's end-of-cycle Farcaster summary now. Uses the deterministic cycle-summary template — accepts only a template hint. Refuses arbitrary text. Idempotent per cycle. Dry-run in non-Actions environments.",
  inputSchema: {
    type: "object",
    properties: {
      templateHint: { type: "string", enum: ["routine","refusal","approval-pending","milestone","buyback","mistake"] },
      noteForReceipt: { type: "string", maxLength: 240 }
    },
    additionalProperties: false
  }
}
```

Handler does NOT take a `text` parameter. Re-runs `summarizeCycleForCast` against the live proof, applies `templateHint` (invalid hints fall back to auto-pick), routes through same `postCycleCast` with same idempotency key. Returns `{kind, hash, dryRun, idempotent, blocked, error}` — never the raw text (compromised model can't exfiltrate via tool output).

**No `cast_text_now` tool exists.** Founder cannot make Orbit say arbitrary words. The only path to a cast is rendered-from-template.

## 6. Outbound safety — existing modules

Before `publishCast` opens a socket:

1. `assertSafePublicReply(text)` from `safety.js` — refuses secrets, private config keys, unapproved financial promises.
2. `redactSecrets(text)` — belt-and-suspenders; if it changes the string, refuse.
3. `scanTextRisk(text)` from `scam.js` — block if `level === "critical"`.
4. Byte-length check — `Buffer.byteLength(text) <= 320`. If over, truncate bullets, retry. If still over, allow LONG_CAST only with explicit `kind === "long-required"`.
5. EVM address check — disallow `0x[a-fA-F0-9]{40}` unless it's `config.treasuryAddress` (which is redacted by sanitizePublicArtifact anyway).
6. URL allowlist — only `orbit.horse`, `github.com`, `basescan.org`. Anything else dropped from `embeds`.

Any failure → `{ok:false, blocked:true, reason}` and reason written into `proof.cast`. Cycle continues.

## 7. Idempotency design

**Idempotency key:** `idem = sha256("orbit-cycle-cast:" + cycle + ":" + finishedAt).slice(0,32)`. Passed verbatim to Neynar as `idem` field; Neynar dedupes server-side.

**Local ledger:** `memory/farcaster-casts.json` — append-only JSON `{ casts: [{ cycle, idem, hash, castedAt, kind, dryRun }] }`. Before posting, read ledger; if cycle has non-dry-run entry with hash, short-circuit. On success write back. Ledger tracked via `filesChanged.add(...)` so it commits with the cycle.

Workflow re-dispatch of same cycle: local ledger short-circuits; if local ledger lost, Neynar `idem` server-side dedupe catches it.

## 8. Failure modes

| # | Failure | Behavior |
|---|---|---|
| 1 | Neynar 5xx / unreachable | One 1.5s back-off retry; on second failure, `proof.cast = {ok:false, error:"neynar_unreachable"}`. Cycle continues. |
| 2 | Rate limit (HTTP 429) | No retry. Log `rate_limit`. Next cycle posts normally. |
| 3 | Signer revoked (HTTP 403/401) | Open approval issue "Orbit Farcaster signer invalid — re-approve". Subsequent cycles short-circuit until sentinel `memory/farcaster-disabled.json` removed. |
| 4 | Text exceeds 320 bytes | Truncate bullets, retry; if still over, LONG_CAST only for `routine`/`milestone`; for `refusal` truncate with ellipsis. |
| 5 | Outbound safety blocks | `proof.cast = {ok:false, blocked:true, reason}`. Surfaces template bug. |
| 6 | No network | Same as #1 (fetch throws). |
| 7 | API key/signer unset | Return `{ok:false, error:"not_configured"}` immediately. Local-dev default. |
| 8 | Idempotency cache hit | Return `{ok:true, idempotent:true, hash}`. No API call. |
| 9 | Workflow re-dispatched | Ledger or Neynar idem catches it. |

## 9. Test plan — `tests/agent/farcaster.test.js`

- `pickTemplate` priority ordering with fixture summaries
- `renderCast` byte budget — multibyte chars → ≤320 bytes; truncation deterministic
- `scanOutbound` refuses fake `gh_...` token, "we will transfer 1 ETH", non-treasury 0x address
- `castIdempotencyKey` stable per `(cycle, finishedAt)`, different across `finishedAt`
- `publishCast` with `ORBIT_FARCASTER_DRY_RUN=true`: returns dry-run shape, fetch never invoked
- Mocked Neynar 200: returns `{ok:true, hash}`
- Mocked 429: no retry, returns `{ok:false, error:"rate_limit"}`
- Mocked 5xx then 200: retried once, returns success
- Ledger short-circuits on re-post
- `cast_to_farcaster` tool rejects unknown `templateHint`; output never includes raw text
- `run.js` integration: fake cycle proof writes a cast record in dry-run mode; `cast.dryRun === true`; receipt URL points to publicBaseUrl

CI sets `ORBIT_FARCASTER_DRY_RUN=true` and provides no real key. Tests hermetic. Live cycle sets `false`.

## 10. Owner setup checklist

- [ ] Register Farcaster account for Orbit (separate from founder). Username `orbit` or `orbit-house`. Pay storage rent (~$5 USDC, one-time).
- [ ] Capture Orbit's FID. Record as repo var `ORBIT_FARCASTER_FID` (informational).
- [ ] Sign up on `dev.neynar.com`. Create an app. Capture API key (server-side) and Client ID (informational only).
- [ ] Create an approved signer: SIWN flow or `POST /v2/farcaster/signer` + QR scan in Warpcast as Orbit. Confirm `status: "approved"`. Capture `signer_uuid`.
- [ ] Add GitHub Actions secrets: `ORBIT_FARCASTER_NEYNAR_API_KEY`, `ORBIT_FARCASTER_SIGNER_UUID`.
- [ ] Add GitHub Actions vars: `ORBIT_FARCASTER_DRY_RUN=false`, `ORBIT_PUBLIC_URL=https://orbit.horse` (after dashboard ships).
- [ ] Extend `.github/workflows/orbit-cycle.yml` env block with those three names.
- [ ] Local `ORBIT_FARCASTER_DRY_RUN=true npm run cycle` and confirm cast text reads in Orbit's voice.
- [ ] Flip `ORBIT_FARCASTER_DRY_RUN=false`. Let one scheduled cycle land. Verify on Warpcast + receipt link resolves.
- [ ] Pin Orbit's Farcaster bio: `i live at github.com/{repo}. i wake every 30m. i sign everything. receipts at orbit.horse.`

## Critical files

- `src/agent/run.js` — main hook
- `src/agent/tools.js` — tool entry
- `src/agent/actions.js` — tool handler
- `src/agent/safety.js` — outbound gates (already exists)
- `src/agent/scam.js` — outbound risk scan (already exists)
- `src/agent/farcaster.js` — NEW
- `tests/agent/farcaster.test.js` — NEW
- `memory/farcaster-casts.json` — NEW (ledger)
- `.github/workflows/orbit-cycle.yml` — env additions
