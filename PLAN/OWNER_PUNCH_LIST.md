# Owner Punch List — S-GATE-1

> One-page executable checklist for the 7 owner-blocked items in `PLAN/SGATE_1.md`.
> Run top-to-bottom. Copy-paste each command block as-is.
> Each item links to its deep runbook for context + threat-model details.

| Status | Item | Time | Deep runbook |
|---|---|---|---|
| ☐ | 1. Enable GitHub Pages | 10 min | `PLAN/DEPLOY_PLAN.md` |
| ☐ | 2. Set `ORBIT_AGENT_SIGNER` repo variable | 5 min | `packages/orbit-keygen/` + `PLAN/DEPLOY_PLAN.md` |
| ☐ | 3. Configure AI provider (MiMo / OpenGateway) | 10 min | `PLAN/PRIVATE_DRYRUN.md` |
| ☐ | 4. Provision Farcaster signer | 30 min | `PLAN/SPECS/FARCASTER_CAST_PIPELINE.md` §10 |
| ☐ | 5. Publish SDK + scaffolder + proof-viewer to npm | 20 min | this file §5 |
| ☐ | 6. Deploy Treasury Safe on Base | 60–90 min | `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md` |
| ☐ | 7. Verify 12-hour clean cycle stretch | 12+ hours wallclock, ~10 min owner | `PLAN/PRIVATE_DRYRUN.md` |

Total active owner time: ~2.5 hours plus a 12-hour observation window.

---

## 1. Enable GitHub Pages

**Why:** Public dashboard URL needed for S-GATE-1 #3 + D-018 #6.

**Prereqs:** Repo public OR a paid GitHub plan that supports Pages on private.

**Commands** (or use the UI — Settings → Pages):

```bash
# 1) Confirm dashboard build artifact ships in CI
gh workflow view deploy-dashboard.yml

# 2) Set the repo variable that flips the dispatch guard
gh variable set PAGES_ENABLED --body "true"

# 3) (Owner: in the GitHub web UI) Settings → Pages →
#    Source: GitHub Actions
#    No custom domain unless you own one (skip — was removed in commit 84767747).

# 4) Trigger first deploy
gh workflow run deploy-dashboard.yml

# 5) Wait, then verify
gh run watch
curl -I "https://orbithousezkp.github.io/orbit/" | head -5
```

**Verification:** `curl -I` returns `200 OK`. Dashboard URL is `https://orbithousezkp.github.io/orbit/`.

**Record:** Done date ____ Proof URL ____

---

## 2. Set `ORBIT_AGENT_SIGNER` repo variable

**Why:** Wallet public address used to sign cycle proofs (D-006). Verifiers reject proofs whose signer doesn't match this variable.

**Prereqs:** A wallet keypair already generated. Use `packages/orbit-keygen` if you don't have one — it never writes the private key to disk uncovered.

**Commands:**

```bash
# 1) Generate (skip if you already have a keypair)
npx orbit-keygen
# Records public 0x address on screen + asks where to write private key.
# IMPORTANT: write the private key only to a password manager or hardware wallet.

# 2) Set the public address as a repo VARIABLE (visible to workflows, not secret)
gh variable set ORBIT_AGENT_SIGNER --body "0xYOUR_PUBLIC_ADDRESS"

# 3) Set the private key as a repo SECRET (encrypted, never readable post-set)
gh secret set ORBIT_WALLET_PRIVATE_KEY
# Paste the 0x... private key when prompted.

# 4) Verify
gh variable list | grep ORBIT_AGENT_SIGNER
gh secret list | grep ORBIT_WALLET_PRIVATE_KEY
```

**Verification:** Both lines present. The next cycle that runs will sign proofs with this signer.

**Record:** Done date ____ Address ____

---

## 3. Configure AI provider (MiMo / OpenGateway)

**Why:** D-018 gate item #3 — Orbit cannot run cycles without an AI provider configured. The inference module is provider-neutral, so any OpenAI-compatible API works.

**Prereqs:** API key for at least one OpenAI-compatible provider (MiMo Pro 2.5 via OpenGateway is the documented dryrun target; Anthropic / OpenRouter / any OpenAI-compatible API also work).

**Commands:**

```bash
# 1) Set provider list (VARIABLE — JSON array of provider configs)
gh variable set ORBIT_AI_PROVIDERS --body '[
  {
    "name": "opengateway",
    "apiBase": "https://api.opengateway.ai/v1",
    "model": "mimo-v2.5-pro",
    "chatPath": "/chat/completions",
    "priority": 1
  }
]'

# 2) Set provider keys (SECRET — JSON object keyed by provider name)
gh secret set ORBIT_AI_PROVIDER_KEYS
# Paste JSON when prompted:
# {"opengateway":"sk-...your-key..."}

# 3) Set daily/monthly budget caps (VARIABLES)
gh variable set ORBIT_AI_DAILY_BUDGET_USD --body "1"
gh variable set ORBIT_AI_MONTHLY_BUDGET_USD --body "20"

# 4) Trigger one cycle and confirm it reads provider OK
gh workflow run orbit-cycle.yml
gh run watch
```

**Verification:** Last cycle run shows `aiRoute.configured: true` in its proof file under `runtime/proofs/`.

**Record:** Done date ____ Provider ____ Daily budget $____

---

## 4. Provision Farcaster signer

**Why:** S-GATE-1 #4 — daily public cycle cast on Farcaster. D-008.

**Prereqs:** A Farcaster account (FID). A Neynar developer account (`https://neynar.com/`) for API access.

**Commands:**

```bash
# 1) Get a Neynar API key (do this in the Neynar dashboard)

# 2) Create a managed signer for your FID via the Neynar API
#    (Detailed flow — including signer approval scan-with-Warpcast step —
#    is in PLAN/SPECS/FARCASTER_CAST_PIPELINE.md §10.)

# 3) Set the resulting credentials
gh secret set ORBIT_FARCASTER_NEYNAR_API_KEY     # Neynar API key
gh secret set ORBIT_FARCASTER_SIGNER_UUID        # signer uuid from Neynar
gh variable set ORBIT_FARCASTER_FID --body "<YOUR_FID>"
gh variable set ORBIT_FARCASTER_DRY_RUN --body "false"

# 4) Trigger a cycle that would normally cast
gh workflow run orbit-cycle.yml
gh run watch
```

**Verification:** `runtime/proofs/<latest>.json` shows a `casts: [{ hash: "0x..." }]` entry. Cross-check at `https://warpcast.com/~/conversations/0x...`.

**Record:** Done date ____ FID ____ First cast hash ____

---

## 5. Publish SDK + scaffolder + proof-viewer to npm

**Why:** S-GATE-1 #5 (second adopter) + S-007 (npm publish for adopter onboarding).

**Prereqs:** npm account, scoped org `@orbit-house` created and verified.

**Commands:**

```bash
# 1) Log in once
npm login

# 2) Publish each package (--access public required for scoped packages)
cd /home/asuran/Downloads/orbit/packages/orbit-sdk
npm publish --access public

cd ../create-orbit-house
npm publish --access public

cd ../proof-viewer
npm publish --access public

cd ../orbit-keygen
npm publish --access public

cd ../orbit-mcp-server
npm publish --access public

# 3) Verify each one is live
npm view @orbit-house/sdk version
npm view @orbit-house/create-orbit-house version
npm view @orbit-house/proof-viewer version
npm view @orbit-house/orbit-keygen version
npm view @orbit-house/orbit-mcp-server version
```

**Verification:** Each `npm view` returns a version number (not 404).

**Smoke test:** `npx @orbit-house/create-orbit-house --help` works from a clean directory.

**Record:** Done date ____ Versions published ____

**Optional first tag** (kicks `publish-packages.yml`):
```bash
git tag sdk-v0.1.0
git push origin sdk-v0.1.0
```

---

## 6. Deploy Treasury Safe on Base

**Why:** S-GATE-1 #7 + D-018 #7. Required substrate for any on-chain action (buyback, merkle anchor, federation gas).

**Prereqs:** Hardware wallet (Ledger / Trezor / GridPlus / Keystone) for signer #1. Two more signer identities decided (see deep runbook §1).

**This is the longest item. The full runbook is `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md` (188 lines, 8 sections including rollback for wrong-network / compromised-signer cases). Do not shortcut — read it.**

Compressed flow:

```bash
# 1) Open https://app.safe.global/ (verify the TLS lock, exact domain spelling).
# 2) Connect a deployer wallet with ~0.1 ETH on Base. Switch network to Base (chain id 8453).
# 3) Create new Safe. Name: "Orbit Treasury". Owners: 3 addresses (each verified byte-for-byte against the device screen). Threshold: 2.
# 4) Confirm deploy tx. Wait for Base confirmation (<30s).
# 5) Copy Safe address. Open https://basescan.org/address/<safe-address>
#    Verify getOwners() == your 3 addresses, getThreshold() == 2.
# 6) Send 0.1 ETH to the Safe address (smoke fund).
# 7) Record into repo:

gh secret set ORBIT_TREASURY_ADDRESS         # the Safe address
gh secret set ORBIT_OPERATOR_REVENUE_ADDRESS # separate EOA for D-017 5%
gh secret set ORBIT_BASE_RPC_URL             # https://mainnet.base.org or your provider
gh variable set ORBIT_OPERATOR_REVENUE_BPS --body "500" # 5% per D-017

# 8) Run a test multisig tx (any tiny ETH transfer back to a signer) and confirm it on Basescan.
# 9) Run preflight to confirm:
npm run orbit:preflight --strict
```

**Verification:** Preflight shows Safe section all-green. Basescan confirms 3 owners + threshold 2. Test tx confirmed.

**Record:** Done date ____ Safe address ____ Test tx hash ____

---

## 7. Verify 12-hour clean cycle stretch

**Why:** D-018 #4 — cron has to actually fire 24 cycles in a row with no failures. This proves operational reliability.

**Prereqs:** Items 1–6 above closed. Pages live. Signer set. AI provider configured. (Farcaster + Safe can be deferred to live launch if you want a softer first 12h.)

**Commands:**

```bash
# 1) Confirm cron is firing on schedule
gh run list --workflow=orbit-cycle.yml --limit 30 --json createdAt,conclusion

# 2) Watch for 24 consecutive runs with conclusion=success (24 * 15min = ~6h
#    if every fire lands; ~12h if some are throttled).
#    On a private repo: scheduled fires are often throttled by GitHub.
#    Either flip the repo public, or use a public "tickler" repo whose
#    cron repository_dispatches into orbit-dryrun. See PRIVATE_DRYRUN.md.

# 3) Once you see 24 in a row with conclusion=success, record the cycle
#    range and flip the master gate flag:

gh api -X PATCH /repos/orbithousezkp/orbit/contents/memory/state.json \
  -f message='S-GATE-1 #4 + D-018 #4: 24 consecutive clean cycles' \
  -f content="$(jq '. + {
    firstCleanCycle: <N>,
    lastCleanCycle: <N+23>,
    preLaunchVerified: true,
    preLaunchVerifiedAt: now | todate,
    preLaunchVerifiedHash: "'$(node -e 'console.log(require("./src/agent/governance").d018CriteriaHash())')'"
  }' memory/state.json | base64 -w0)" \
  -f sha=$(gh api /repos/orbithousezkp/orbit/contents/memory/state.json --jq '.sha')

# Note: preLaunchVerifiedHash is required by T-2 (committed 2026-05-28).
# Without it, the gate refuses to consider the flag valid.
```

**Verification:**
```bash
npm run orbit:preflight --strict
# Section "D-018 gate state" should show all rows PASS.
```

**Record:** Done date ____ Cycle range ____ — ____ Verified hash ____

---

## Closing the gate

When all 7 items above are ticked AND `npm run orbit:preflight --strict` shows 0 FAIL, append to the bottom of `PLAN/SGATE_1.md`:

```
GATE CLOSED: ____ (date)
Signed by: ____ (owner GitHub handle)
Next session: S-011 — Clanker v4 deploy dry run
```

Phase 2 starts on the next commit after that line lands.

---

## Common snags

- **`gh` command refuses `workflow` operations.** Run `gh auth refresh -h github.com -s workflow` and retry.
- **`gh variable set` says "variable already exists".** Use `--body` to overwrite. There is no separate update command.
- **Cron fires 1× every 8 hours instead of every 15 minutes.** GitHub Actions throttles cron on private repos under heavy fleet load. Options: (a) flip repo public, (b) public tickler repo dispatch-into-private, (c) accept the cadence for the 12h stretch.
- **Pages deploy fails with `pages site not found`.** Owner did not enable Pages in repo settings yet, or did not flip `PAGES_ENABLED=true` (the workflow gates dispatch on this var).
- **Safe deployed to wrong network.** See `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md` §8.2. Do not fund the wrong-network Safe; deploy a fresh one on Base, update the secret, abandon the wrong-network Safe.

---

## When NOT to use this checklist

This is the **S-GATE-1** punch list — the Phase 1 → Phase 2 transition. Do not run any of these items before:

- All shipped tests pass: `npm test` ≥1537/1537
- `npm run health` reports 0 FAIL
- VERIFICATION_MATRIX.md shows 0 FAIL

If any of those are red, fix engineering first. Owner action does not paper over broken engineering.
