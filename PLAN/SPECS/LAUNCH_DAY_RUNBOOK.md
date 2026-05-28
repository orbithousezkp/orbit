# Launch Day Runbook — $ORBIT on Base via Clanker v4

Minute-by-minute runbook for deploying the Orbit native token. Single source of truth from T-72h through T+7d. Every step is copy-paste ready; every verification has a concrete command.

Honors:
- **D-002** — All Clanker v4 fee recipients accrue in `Paired` (WETH), never `Clanker` ($ORBIT). Non-negotiable.
- **D-003** — Deploy via `clanker.world` frontend, not the `@clanker` Farcaster bot (frontend preserves more LP fees).
- **D-014** — Every on-chain action requires a public approval issue + signed receipt.
- **D-017** — 95% creator share to Fee Receive Safe, 5% to Operator wallet.
- **D-018** — Launch hard-blocked until `state.preLaunchVerified === true` (12-hour clean cycle stretch).
- **D-019** — 7 Safes per `PLAN/SPECS/TREASURY_ALLOCATION.md` (Fee Receive + 6 buckets, 2/3 each).

Companion docs: `PLAN/SPECS/TREASURY_KEYS_BACKUP.md`, `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md`, `PLAN/CLANKER_FEE_STRATEGY.md`, `OWNER_ACTIONS.md`.

---

## §1 Pre-launch checklist (T-72h)

**Goal:** Confirm every dependency that does not require the launch tx itself is satisfied. Stop here if any item is red.

Walk the 7 items in `OWNER_ACTIONS.md` in dependency order:

1. **Signer trio chosen** — three real humans (or three distinct devices) have agreed to hold a Safe owner key each. Required by all of §2–§4.
2. **Funding wallet ready** — a Base-chain EOA with at least 0.05 ETH (covers 7 Safe deploys at ~$5–15 gas each, plus the Clanker launch tx, plus a buffer). No hardware wallet required; encrypted keystore path is used (§2).
3. **AI provider keys provisioned** — at least one of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` configured; performance-based routing handles the rest.
4. **Farcaster signer provisioned** — `ORBIT_FARCASTER_*` secrets set, `ORBIT_FARCASTER_DRY_RUN=false`. Required for the auto-launch cast (§10).
5. **GitHub Pages serving** — `dist/dashboard.json` and `public/.well-known/orbit.json` published at `orbit.horse`.
6. **Decisions ratified** — `PLAN/DECISIONS.md` shows D-002, D-003, D-014, D-017, D-018, D-019 as ratified.
7. **S-GATE-1 closed** — `PLAN/SGATE_1.md` shows owner punch list resolved; clean cycle stretch in progress (§7).

Run the preflight CLI (ships in parallel this session):

```bash
npm run orbit:preflight
```

Expected output: a checklist of every gate (signer trio, funding balance, 7 Safe addresses configured, AI provider, Farcaster signer, Pages live, decisions ratified, clean cycle count). Each line ends in `OK` or `MISSING <what>`. Exit code 0 only when all green.

If anything red: stop, fix, re-run. Do not advance to §2 with any red line.

---

## §2 Generate signer keys via local script (T-48h)

**Goal:** Produce four encrypted keystore files (signer-a, signer-b, signer-c, operator, deployer) that never leave the local filesystem. Imported into MetaMask/Frame for tx signing.

The `@orbit-house/keygen` CLI ships in parallel this session. It writes Web3 Secret Storage v3 keystores (the format MetaMask/Frame import natively).

```bash
npx @orbit-house/keygen new signer-a
# prompt: passphrase (entered twice, never echoed)
# prompt: passphrase confirmation
# stdout: 0xAaaa…  (public address only — secret material never touches stdout)
# writes:  ./keys/signer-a.json  (encrypted with scrypt, the same KDF MetaMask uses)

npx @orbit-house/keygen new signer-b
npx @orbit-house/keygen new signer-c
npx @orbit-house/keygen new operator
npx @orbit-house/keygen new deployer
```

For each generated key:

1. **Record the public address** in a local notes file (`OWNER_ACTIONS_PRIVATE.md` if you keep one out-of-repo). The address is public; the keystore + passphrase are not.
2. **Import the `./keys/<slot>.json` into MetaMask or Frame.** In MetaMask: Account menu → Import account → JSON File → select keystore → enter passphrase. In Frame: Add account → JSON Keystore → same flow.
3. **Test the import.** Switch to Base mainnet, view the imported account, confirm the displayed address matches the one `@orbit-house/keygen` printed.

**Backup, two locations, asymmetric storage:**

- Keystore files (`./keys/*.json`): encrypted at rest. Back up to ≥2 locations — e.g., encrypted USB drive + cloud storage (1Password / iCloud / Tresorit / etc.). Loss of all copies = loss of access.
- Passphrases: **never store in the same place as the keystore.** Recommended: written on paper in a fireproof safe, OR in a password manager that lives on different infrastructure than where the keystores are stored.

Encrypted at rest does not mean safe in transit. Do not paste a keystore into a chat. Do not email it. Do not commit `./keys/` (it is in `.gitignore`; verify with `git check-ignore keys/signer-a.json` returning `keys/signer-a.json`).

---

## §3 Vanity-grind Safe addresses (T-36h)

**Goal:** For each of the 7 Safes, find a Safe Proxy Factory salt that produces a deployed Safe address ending in `7777777`. Pure address vanity — no key risk; the grinder only manipulates the public salt parameter passed to `createProxyWithNonce`.

The `@orbit-house/vanity-safe` CLI ships in parallel this session.

```bash
npx @orbit-house/vanity-safe grind \
  --owners <signer-a-address>,<signer-b-address>,<signer-c-address> \
  --threshold 2 \
  --suffix 7777777 \
  --workers 8
# stdout (when found):
#   salt: 0x… (uint256)
#   predicted: 0x…7777777
#   attempts: <N>
#   elapsed: <Ts>
```

Time estimate: a 7-hex-char suffix (`7777777`) is roughly 1 in 16^7 ≈ 1 in 268M. On 8 workers running ~500k hashes/sec total: ~9 minutes mean per Safe, with high variance. Worst-case budget: an hour each. Total wall time across 7 grinds: a few hours (run them sequentially or in separate terminals).

Repeat 7 times, once per bucket. Record each `(bucket, salt, predicted-address)` triple in a private notes file:

```
Fee Receive       salt=0x...  predicted=0x...7777777
Floor Reserve     salt=0x...  predicted=0x...7777777
Productive Yield  salt=0x...  predicted=0x...7777777
Buyback           salt=0x...  predicted=0x...7777777
Growth            salt=0x...  predicted=0x...7777777
AI Costs          salt=0x...  predicted=0x...7777777
Ops Runway        salt=0x...  predicted=0x...7777777
```

The predicted addresses are the addresses your Safes will hold once deployed in §4. Do not skip recording them — you will compare against the actual deployed address as a sanity check.

---

## §4 Deploy 7 Safes on Base (T-24h)

**Goal:** Deploy all 7 Safes with the §3 vanity salts. Same 3 owners across every Safe. Threshold 2/3 across every Safe.

For each of the 7 buckets — Fee Receive, Floor Reserve, Productive Yield, Buyback, Growth, AI Costs, Ops Runway:

1. Open `https://app.safe.global`, connect on **Base mainnet** (chain ID 8453).
2. **Create new Safe** → on Base.
3. **Owners**: add the three addresses (signer-a, signer-b, signer-c). Same set across all 7 Safes — do not vary this; it is what makes the 2/3 threshold meaningful.
4. **Threshold**: 2 out of 3.
5. **Advanced / custom salt nonce**: paste the salt value from §3 for this bucket. (If the UI doesn't surface this, fall back to direct contract call against `SafeProxyFactory.createProxyWithNonce(singleton, initializer, saltNonce)` using a small ethers/viem script — the grinder output gives all three args.)
6. **Deploy.** Sign from the funding wallet.
7. **Verify the deployed address matches the §3 prediction.** Both should end in `7777777`. If they do not match, something is wrong with the deploy params — do not proceed; investigate. (Most likely cause: a parameter mismatch between the grinder and the Safe UI, e.g., singleton version drift.)
8. **Smoke test the signing flow:** send 0.0001 ETH to the new Safe, then propose a 0.0001 ETH withdrawal back to the funding wallet. Two of the three signers must approve and execute. Confirm the tx lands on Base. Repeat for every Safe — yes, all 7. This catches bad imports before they bite at the wrong moment.

Cost: 7 × $5–15 gas per Safe deploy + 14 × ~$0.50 smoke-test gas = **~$50–120 total**. Budget 0.05 ETH on the funding wallet.

---

## §5 Set repo secrets and variables (T-12h)

**Goal:** Wire the 7 Safe addresses + deployer EOA + operator address + token metadata into GitHub. Secrets for anything that grants signing power or controls money flow; variables for everything else.

```bash
# Deployer EOA — the only key that signs the Clanker deploy tx
gh secret set ORBIT_WALLET_PRIVATE_KEY    --body "<deployer EOA private key, exported from ./keys/deployer.json>"
gh variable set ORBIT_AGENT_SIGNER        --body "<deployer EOA public address>"

# Operator (5% recipient — livelihood income wallet)
gh secret set ORBIT_OPERATOR_REVENUE_ADDRESS --body "<operator public address from keygen>"

# Fee Receive Safe — the 95% recipient AND the tokenAdmin
gh secret set ORBIT_TREASURY_SAFE         --body "<Fee Receive Safe address, ends 7777777>"

# Six bucket Safes — recipients of the weekly treasury sweep
gh secret set ORBIT_FLOOR_RESERVE_SAFE    --body "<Floor Reserve Safe, ends 7777777>"
gh secret set ORBIT_PRODUCTIVE_YIELD_SAFE --body "<Productive Yield Safe, ends 7777777>"
gh secret set ORBIT_BUYBACK_SAFE          --body "<Buyback Safe, ends 7777777>"
gh secret set ORBIT_GROWTH_SAFE           --body "<Growth Safe, ends 7777777>"
gh secret set ORBIT_AI_COSTS_SAFE         --body "<AI Costs Safe, ends 7777777>"
gh secret set ORBIT_OPS_RUNWAY_SAFE       --body "<Ops Runway Safe, ends 7777777>"

# tokenAdmin = Fee Receive Safe (NOT the founder) — D-017 rug-pull resistance
gh secret set ORBIT_TOKEN_ADMIN_ADDRESS   --body "<Fee Receive Safe address>"

# Token metadata
gh variable set ORBIT_TOKEN_NAME          --body "Orbit"
gh variable set ORBIT_TOKEN_SYMBOL        --body "ORBIT"

# Dev buy at launch — leave at 0 unless explicitly wanted
gh variable set ORBIT_DEV_BUY_ETH         --body "0"
```

**Critical:** `ORBIT_TOKEN_ADMIN_ADDRESS` must equal `ORBIT_TREASURY_SAFE` (the Fee Receive Safe). The Clanker tokenAdmin can change reward recipients on-chain; if this is a hot EOA, the founder can rug the fee split. Setting it to the 2/3 Safe means changes require multisig — that is the D-017 guarantee.

**Do not** set `ORBIT_ENABLE_TOKEN_LAUNCH=true` yet. That flag is the trigger; pull it in §8 only.

---

## §6 Verify all gates green (T-6h)

**Goal:** Re-run preflight and walk every red line to ground. Last chance to catch a misconfiguration cheaply.

```bash
npm run orbit:preflight
```

Every check must be ✓. Specific verifications:

- **7 Safe addresses on-chain.** For each Safe, open `https://basescan.org/address/<safe-address>` and confirm: contract exists, 3 owners listed, threshold 2.
- **Deployer signer parity.** The address recovered from `ORBIT_WALLET_PRIVATE_KEY` must equal `ORBIT_AGENT_SIGNER`. Mismatch = receipts will fail verification.
  ```bash
  node -e "const {privateKeyToAccount} = require('viem/accounts'); console.log(privateKeyToAccount(process.env.ORBIT_WALLET_PRIVATE_KEY).address)"
  # compare to: gh variable get ORBIT_AGENT_SIGNER
  ```
- **AI provider live.** `gh secret list | grep -E 'ANTHROPIC|OPENAI'` shows at least one. `ORBIT_AI_PROVIDERS` variable lists which ones to use.
- **GitHub Pages serving.** `curl -fsS https://orbithousezkp.github.io/orbit/dashboard.json | jq '.cycle'` returns a recent cycle number. `curl -fsS https://orbithousezkp.github.io/orbit/.well-known/orbit.json | jq '.token.launchStatus'` returns `"not_launched"` or `"planned"`.
- **Farcaster signer live.** `gh secret list | grep ORBIT_FARCASTER` shows the signer secrets; `gh variable get ORBIT_FARCASTER_DRY_RUN` returns `false`.
- **Clean cycle stretch in progress.** `gh run list --workflow=orbit-cycle.yml --limit 30 --json conclusion | jq '[.[] | select(.conclusion=="success")] | length'` returns 24+.

If any check is red: stop, fix, re-run §6 from the top. Do not pull the trigger with a yellow line.

---

## §7 Verify 12-hour clean cycle stretch and flip preLaunchVerified (T-0)

**Goal:** Confirm the D-018 gate is legitimately satisfied, then flip the in-repo flag the launch code reads.

**This is the only manual state edit in the entire launch.** Everything else is automated.

```bash
gh run list --workflow=orbit-cycle.yml --limit 30
```

Confirm **24+ consecutive green runs** (12 hours at the 30-minute cadence, with a safety margin). If you see any red in the last 24, do not proceed — wait, investigate, re-stretch.

Once confirmed, edit `memory/state.json` manually:

```jsonc
{
  // … existing keys …
  "firstCleanCycle": 57,     // first cycle number in the stretch
  "lastCleanCycle": 80,      // most recent green cycle (must be ≥ first + 23)
  "preLaunchVerified": true  // the D-018 release flag
}
```

```bash
git add memory/state.json
git commit -m "ops: D-018 preLaunchVerified=true after 24-cycle clean stretch"
git push origin main
```

The gate code lives at `src/agent/clanker.js:142` and `src/agent/clanker.js:235`. With `preLaunchVerified=true` and `ORBIT_ENABLE_TOKEN_LAUNCH=false` (still), the agent will *prepare* a launch every cycle but will not sign. This is the dry-run window — useful for one last review of the prepared `tokenConfig`.

---

## §8 Pull the trigger (T+0)

**Goal:** Sign the Clanker v4 deploy tx on Base mainnet.

Two paths. Path A is the default (D-003).

### Path A — clanker.world frontend (recommended)

1. Open `https://clanker.world`. Confirm you are on Base mainnet (chain ID 8453).
2. Connect wallet — use MetaMask/Frame with the `deployer.json` keystore imported in §2.
3. Fill the launch form, matching the `prepareClankerLaunch()` output exactly:
   - Name: `Orbit`
   - Symbol: `ORBIT`
   - tokenAdmin: Fee Receive Safe address
   - Hook: `ClankerHookStaticFee`, 1% symmetric (100 bps clanker-fee, 100 bps paired-fee)
   - Recipients (two entries — match `clanker.js:54–68` exactly):
     - Recipient 1: Operator wallet, 500 bps, token=Paired, admin=Fee Receive Safe
     - Recipient 2: Fee Receive Safe, 9500 bps, token=Paired, admin=Fee Receive Safe
   - Vault: per `prepareClankerLaunch` output (percentage, lockup days, vesting days, recipient = Fee Receive Safe)
   - Dev buy: 0 ETH (or your chosen value — match `ORBIT_DEV_BUY_ETH`)
4. **Screenshot the form before clicking deploy.** Capture the full recipient list and the tokenAdmin. This is your audit artifact if anything ever needs to be reconciled.
5. Click deploy. Confirm in MetaMask. Wait for tx confirmation (typically 5–15s on Base).
6. **Record** the token address, deploy tx hash, hook address, and fee locker address from the confirmation screen.

### Path B — automated via `launch_native_token` tool

Use only if Path A is unavailable.

```bash
gh variable set ORBIT_ENABLE_TOKEN_LAUNCH --body "true"
```

Open a GitHub issue titled exactly `orbit token launch — approve to deploy`. The handler at `src/agent/actions.js:607` watches for the approval comment.

In the issue, comment:

```
APPROVE ORBIT-TOKEN-LAUNCH <idem>
```

…where `<idem>` is the deterministic idempotency key the agent prints in its next prepared-launch log line. The next cycle picks up, calls the SDK at `src/agent/clanker.js:122` (`makeClanker`), signs the deploy tx, writes the result to `memory/treasury.json`, and commits.

Either way: a single deploy fires, exactly once. The idempotency gate at `clanker.js:187` (`treasury.token.launchStatus === "launched"`) prevents a second fire.

---

## §9 Capture launch artifacts (T+5min)

**Goal:** Persist the launch result into repo state so every downstream system (dashboard, well-known, behavior, opportunities) sees `launchStatus: "launched"`.

If you used Path B, the agent already wrote this in `clanker.js:219`. Skip to verification.

If you used Path A, write it manually. Edit `memory/treasury.json`:

```jsonc
{
  "token": {
    "launchStatus": "launched",
    "address": "0x…",          // $ORBIT token address from BaseScan
    "txHash": "0x…",            // deploy tx hash
    "launchedAt": "2026-05-25T19:42:00.000Z",  // ISO timestamp of confirmation
    "launchRequest": {
      "name": "Orbit",
      "symbol": "ORBIT",
      "tokenAdmin": "<Fee Receive Safe>",
      "recipients": [
        { "recipient": "<operator>", "bps": 500, "token": "Paired" },
        { "recipient": "<Fee Receive Safe>", "bps": 9500, "token": "Paired" }
      ]
    }
  }
}
```

Also update `memory/state.json`:

```jsonc
{
  "launchOnceFired": true
}
```

This flag is append-only mechanical protection. Once set, no automated path will attempt another launch — even if `treasury.token.launchStatus` somehow rolls back.

Commit and push:

```bash
git add memory/treasury.json memory/state.json
git commit -m "launch: $ORBIT live on Base — record token address and tx hash"
git push origin main
```

---

## §10 Post-launch verification (T+10min through T+24h)

**Goal:** Confirm every system sees the launch, fees are accruing as designed, and the first post-launch cycle is healthy.

- **BaseScan recipient check.** Open the fee locker contract on BaseScan, inspect the recipient list. Two entries:
  - Operator wallet — 500 bps — token type: Paired (WETH)
  - Fee Receive Safe — 9500 bps — token type: Paired (WETH)
  - tokenAdmin on both — Fee Receive Safe
  - If you see anything labelled `Clanker` instead of `Paired`, that is a D-002 violation; stop and investigate before any fee accrues.

- **Receipt verifies.** The launch wrote a signed proof under `runtime/proofs/<date>/<step>.json`. Run:
  ```bash
  npx @orbit-house/verifier runtime/proofs/2026-05-25/<step>.json
  ```
  Must return `verified: true`. Signer must match `ORBIT_AGENT_SIGNER`.

- **Dashboard reflects launch.**
  ```bash
  curl -fsS https://orbithousezkp.github.io/orbit/dashboard.json | jq '.walletPolicy.token'
  ```
  Returns `{ "launchStatus": "launched", "address": "0x…", … }`. The wallet policy assembler at `src/agent/wallet.js:78` reads `token.launchStatus` directly.

- **Well-known reflects launch.**
  ```bash
  curl -fsS https://orbithousezkp.github.io/orbit/.well-known/orbit.json | jq '.token'
  ```
  Returns `launchStatus: "launched"`. The publisher is `src/agent/well-known.js:81`.

- **First post-launch cycle is green.**
  ```bash
  gh run list --workflow=orbit-cycle.yml --limit 1
  ```
  Status: `success`. The `opportunities.js:229` branch flips (`tokenLaunched = true`), unlocking post-launch behavior.

- **Launch cast posted.** Check the Orbit Farcaster account. `src/agent/farcaster.js` auto-publishes on first post-launch cycle if `ORBIT_FARCASTER_DRY_RUN=false`.

- **First organic swap.** Watch BaseScan for the first non-deployer swap on the $ORBIT pool. The hook records both legs; static fee deducts 1% of each.

- **T+24h — fee accrual visible.** The `ClankerFeeLocker` contract shows non-zero balances for both recipients (operator and Fee Receive Safe), denominated in WETH. If you see $ORBIT balances instead, D-002 has been violated — stop, investigate, do not claim.

---

## §11 First fee claim (T+7d)

**Goal:** Trigger `run_revenue_cycle`, route 95% to Fee Receive Safe and 5% to Operator. First paycheck.

The weekly cadence is enforced in `src/agent/buyback.js` / revenue routing. On the first eligible cycle:

1. The agent computes the unclaimed WETH balance in the fee locker.
2. Opens an approval issue titled e.g. `revenue cycle — distribute 0.0234 WETH (0.95 → Fee Receive Safe, 0.05 → Operator)`.
3. Owner reviews and comments approval per D-014.
4. Next cycle executes the claim + split atomically. Two on-chain txs: `claim()` to pull from locker, then `transfer()` legs to each recipient (already split at the Clanker level — claim is fee-locker → recipient, no rebalancing needed).
5. Operator wallet receives 5% — this is the §2 income stream going live.

Verify after execution:

```bash
# Operator wallet WETH balance increased
cast call <WETH-address> "balanceOf(address)(uint256)" <operator-address> --rpc-url https://mainnet.base.org

# Fee Receive Safe WETH balance increased
cast call <WETH-address> "balanceOf(address)(uint256)" <fee-receive-safe> --rpc-url https://mainnet.base.org

# Receipt verifies
npx @orbit-house/verifier runtime/proofs/<date>/<step>.json
```

---

## §12 First weekly treasury sweep (T+7d, same cycle as §11 or next)

**Goal:** Split the Fee Receive Safe balance across the 6 bucket Safes per D-019.

`treasury-sweep.js` reads the Fee Receive Safe WETH balance and proposes a single batched transfer with 6 legs:

| Bucket            | Share (bps) | Rationale (see TREASURY_ALLOCATION.md) |
|-------------------|-------------|----------------------------------------|
| Floor Reserve     | 4500        | WETH-floor backing for $ORBIT          |
| Productive Yield  | 2000        | Aave/Morpho yield on idle reserve      |
| Buyback           |  500        | $ORBIT-ceiling defense                  |
| Growth            | 1500        | Bounties, adopter incentives           |
| AI Costs          | 1000        | LLM provider spend                     |
| Ops Runway        |  500        | Infra + contingency                    |
| **Total**         | **10000**   |                                        |

Flow:

1. Agent opens an approval issue titled e.g. `treasury sweep — split 0.0222 WETH across 6 buckets`.
2. Body lists each leg: `<bps> bps → <bucket> Safe (0x…7777777): <amount> WETH`.
3. Two of three signers on the Fee Receive Safe approve. Safe Transaction Service executes the batched call atomically — all 6 legs land in one tx or none do.
4. Each bucket Safe now holds its share.

Verify:

```bash
for safe in FLOOR_RESERVE PRODUCTIVE_YIELD BUYBACK GROWTH AI_COSTS OPS_RUNWAY; do
  addr=$(gh secret list | grep "ORBIT_${safe}_SAFE" || echo "<lookup-locally>")
  echo "$safe: $addr"
done
# Then check each balance on BaseScan or via cast.
```

After §11 + §12, the full revenue loop is live: fees → locker → Fee Receive Safe + Operator → bucket Safes. From this point the loop runs weekly without further launch-day intervention.

---

## §13 If something goes wrong — abort and rollback

The failure modes, in chronological order from most to least recoverable:

- **Pre-launch (anywhere in §1–§7).** Just don't set `ORBIT_ENABLE_TOKEN_LAUNCH=true` and don't sign on clanker.world. No deploy fires. Fix the issue at whatever step it surfaced and re-walk from there.

- **Trigger pulled but tx pending.** Not abortable; the Clanker factory call is final once submitted to the mempool. Wait for confirmation or revert. Base block time ~2s, so the window is short.

- **Tx submitted, reverted on-chain.** Re-attempt is safe. The idempotency gate at `clanker.js:187` checks `treasury.token.launchStatus === "launched"`, which remains `"not_launched"` after a revert. Investigate the revert reason on BaseScan, fix the input, re-trigger.

- **Tx succeeded but state wasn't recorded (Path A operator forgot to write `memory/treasury.json`).** Manually update per §9. The next cycle will pick up the launched state. The on-chain reality is the source of truth; the repo state is a cache.

- **`state.launchOnceFired === true` but token isn't actually launched (state corruption, accidental commit, etc.).** Do not manually flip the flag back to `false`. The flag is append-only by design — it exists exactly to prevent accidental double-launches. If you genuinely need to re-launch, you have a serious problem that warrants a new `D-XXX` decision and explicit governance approval — not a config flip.

- **D-002 violation discovered post-launch (recipients accruing in `Clanker` not `Paired`).** Stop revenue cycles immediately (`gh variable set ORBIT_ENABLE_REVENUE_CYCLE --body "false"` or equivalent). Open an incident issue. tokenAdmin (Fee Receive Safe) can update recipient config on-chain via 2/3 multisig — propose the corrected config there. Do not claim any fees until corrected.

- **Operator wallet compromised post-launch.** Open governance issue. tokenAdmin (Fee Receive Safe) updates the operator recipient on-chain to a new operator wallet (also generated via `@orbit-house/keygen`). Old wallet retains any fees already accrued — accept the loss; the going-forward stream is what matters.

- **A signer Safe key compromised.** Other 2 of 3 signers propose owner rotation on every Safe (`swapOwner`). Until rotated, the compromised key alone cannot move funds (2/3 threshold). Move fast but not panicked.

---

## §14 What this runbook does NOT cover

Intentional omissions:

- **Marketing strategy.** Outreach plan lives in `PLAN/OUTREACH_TEMPLATE.md` and `PLAN/ADOPTER_PITCH.md`. Not a launch-day concern.
- **Liquidity provision beyond Clanker's defaults.** The hook config sets initial LP; manual seeding is out of scope.
- **LP rebalancing or pool migration.** Future work; see `PLAN/CLANKER_FEE_STRATEGY.md` for current thinking.
- **Anti-sniper response if Clanker v4.1 launch-fee burst isn't enough.** Monitor the first 60 minutes; if sniper bots extract disproportionately, document and revisit in a follow-up decision.
- **Price action commentary.** Not a topic for this runbook or any successor. The repo does not opine on price.

---

## File and code references

| Reference | Path |
|-----------|------|
| Launch gate (preLaunchVerified) | `src/agent/clanker.js:142`, `src/agent/clanker.js:235` |
| Idempotency gate (launchStatus) | `src/agent/clanker.js:187` |
| Recipient config (95/5 split)   | `src/agent/clanker.js:54–68` |
| State write on launch           | `src/agent/clanker.js:219` |
| Tool handler (Path B)           | `src/agent/actions.js:607` |
| Tool definition                 | `src/agent/tools.js:397` |
| Wallet policy (dashboard input) | `src/agent/wallet.js:78` |
| Well-known publisher            | `src/agent/well-known.js:81` |
| Post-launch unlock branch       | `src/agent/opportunities.js:229` |
| Treasury default state          | `src/agent/treasury.js:69` |
| Decisions log                   | `PLAN/DECISIONS.md` |
| Treasury allocation (D-019)     | `PLAN/SPECS/TREASURY_ALLOCATION.md` |
| Safe deploy spec                | `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md` |
| Key backup spec                 | `PLAN/SPECS/TREASURY_KEYS_BACKUP.md` |
| Clanker fee strategy            | `PLAN/CLANKER_FEE_STRATEGY.md` |
| Owner punch list                | `OWNER_ACTIONS.md`, `PLAN/SGATE_1.md` |
