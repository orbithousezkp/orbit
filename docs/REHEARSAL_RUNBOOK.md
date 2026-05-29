# Rehearsal Runbook — Public-Ready Orbit on a Private Repo

> Goal: run the complete public-launch sequence on a private GitHub repo with a $1 throwaway token + $0.5 buyback on Base mainnet, before the public repo flips `state.preLaunchVerified`. Total real money at risk: ≤ $1.50.

This runbook is the owner's playbook. The agent has already done everything it can do on this side of the line (tagline closeout, 443/443 tests green, lint/build/health clean). Below are the steps only the owner can do because they require credentials, real money, and an external GitHub repo.

---

## 0. Prerequisites checklist

Tick each before starting:

- [ ] A throwaway EOA on Base with ≥ $5 of ETH (for gas + token launch + buy + buffer). Generate fresh — do not reuse mothership keys.
- [ ] A second throwaway EOA designated as `ORBIT_AGENT_SIGNER` for proof signing.
- [ ] A throwaway Farcaster signer + FID via Neynar (or skip casting by leaving `ORBIT_FARCASTER_DRY_RUN=true`).
- [ ] A throwaway Base RPC URL (Alchemy/QuickNode free tier is fine).
- [ ] An AI provider key for `ORBIT_AI_PROVIDERS` + `ORBIT_AI_PROVIDER_KEYS` (the same Anthropic key as production is fine — small workload).
- [ ] The npm packages `@orbithouse/sdk` + `@orbithouse/create-orbit-house` + `@orbithouse/verifier` published (S-GATE-1 #5). Without this, you cannot scaffold an external adopter — but for the rehearsal we **clone this repo verbatim** instead of scaffolding, so this prerequisite is **optional** for the rehearsal itself.

---

## 1. Create the private rehearsal repo

```bash
gh repo create <owner>/orbit-rehearsal --private --description "Throwaway rehearsal of Orbit public-launch path. Do not touch."
git clone https://github.com/<owner>/orbit-rehearsal.git
cd orbit-rehearsal

# Bring in the public-ready Orbit code verbatim
git remote add upstream /home/asuran/Downloads/orbit
git fetch upstream main
git reset --hard upstream/main
git remote remove upstream

# Wipe the mothership's memory — rehearsal starts fresh
rm -rf runtime/proofs/* memory/farcaster-casts.json memory/state.json
git add -A && git commit -m "rehearsal: import public-ready orbit, reset memory"
git push origin main
```

---

## 2. Set repo Variables + Secrets

Use `gh variable set` / `gh secret set` from the `orbit-rehearsal` checkout.

### Variables (public to workflows, not sensitive)

| Var | Value for rehearsal | Notes |
|---|---|---|
| `ORBIT_OWNER_USERNAME` | your GitHub handle | gates approval comments |
| `ORBIT_DRY_RUN` | `false` | required to actually act |
| `ORBIT_COMMIT_CHANGES` | `true` | needed for cycle to commit |
| `ORBIT_PUSH_CHANGES` | `true` | needed for cycle to push |
| `ORBIT_ALLOW_COMMANDS` | `false` | keep OFF for safety |
| `ORBIT_FARCASTER_DRY_RUN` | `true` initially; flip to `false` only when you want a real cast | |
| `ORBIT_ENABLE_TOKEN_LAUNCH` | `false` initially; flip to `true` only for §6 | |
| `ORBIT_ENABLE_REVENUE_CLAIMS` | `false` | not needed for rehearsal |
| `ORBIT_TOKEN_NAME` | `OrbitRehearsal` | clearly a throwaway |
| `ORBIT_TOKEN_SYMBOL` | `REHRSL` | |
| `ORBIT_TOKEN_DESCRIPTION` | `Throwaway rehearsal token. Not for trade. Will be abandoned after rehearsal closes.` | overrides default |

### Secrets (sensitive)

| Secret | Value for rehearsal |
|---|---|
| `ORBIT_BASE_RPC_URL` | throwaway Base RPC URL |
| `ORBIT_WALLET_PRIVATE_KEY` | throwaway deployer EOA private key |
| `ORBIT_AGENT_SIGNER` | throwaway proof-signer EOA address (NOT private key — just address) |
| `ORBIT_TOKEN_ADMIN_ADDRESS` | owner EOA address (sub for Treasury Safe at this scale) |
| `ORBIT_TREASURY_ADDRESS` | owner EOA address (same) |
| `ORBIT_OPERATOR_REVENUE_ADDRESS` | owner EOA address (same) |
| `ORBIT_AI_PROVIDERS` | JSON route list |
| `ORBIT_AI_PROVIDER_KEYS` | provider key JSON |
| `ORBIT_FARCASTER_NEYNAR_API_KEY` | throwaway Neynar key (optional if FARCASTER_DRY_RUN=true) |
| `ORBIT_FARCASTER_SIGNER_UUID` | throwaway Farcaster signer (optional) |

> The proof-signing keypair is split: the runner needs the private key (`ORBIT_WALLET_PRIVATE_KEY`) and the public address goes in `ORBIT_AGENT_SIGNER` for verification.

---

## 3. Trigger the workflows and observe the 12-hour clean stretch

```bash
# Force a first cycle to confirm everything wires up
gh workflow run orbit-cycle.yml

# Watch
gh run list --workflow=orbit-cycle.yml --limit 5
gh run view <run-id> --log
```

The first cycle should:
- Read memory, run inference, execute tools, write a proof under `runtime/proofs/<date>/<ts>.json`, commit + push.
- Exit 0.

Then **let the 30-minute cron run on its own for 24 consecutive cycles (12 hours)**. No manual triggers between them. Check after 12h:

```bash
gh run list --workflow=orbit-cycle.yml --limit 30 --json conclusion --jq '.[].conclusion' | sort | uniq -c
# All 24 must say "success". Any "failure" or "cancelled" → fix root cause, restart the 24-cycle count.
```

While this runs, watch for:
- Proof files growing in `runtime/proofs/<date>/`.
- Memory commits with no merge conflicts.
- No "Risky content" or "Approval required" exits on baseline content.

---

## 4. Flip `state.preLaunchVerified = true` on the rehearsal repo

When 24 consecutive cycles are green, edit `memory/state.json` directly via PR (this is the D-018 gate flip):

```bash
gh pr create --title "[rehearsal] D-018 gate flip" --body "12-hour clean stretch verified."
# Edit memory/state.json in the PR branch:
#   "preLaunchVerified": true,
#   "firstCleanCycle": <first run-id from the stretch>,
#   "lastCleanCycle":  <last run-id from the stretch>
gh pr merge --squash
```

Verify the flag is in place:

```bash
gh api repos/<owner>/orbit-rehearsal/contents/memory/state.json --jq '.content' | base64 -d | jq '.preLaunchVerified'
# → true
```

---

## 5. Verify a clean cycle still happens after the flip

```bash
gh workflow run orbit-cycle.yml
gh run view <latest-run-id> --log
```

Must exit 0 and write another signed proof. This catches any regression introduced by the flag.

---

## 6. Execute the $1 launch via approval issue

Set `ORBIT_ENABLE_TOKEN_LAUNCH=true` first:

```bash
gh variable set ORBIT_ENABLE_TOKEN_LAUNCH --body "true"
```

Open the launch approval issue:

```bash
gh issue create \
  --title "[orbit launch] propose token launch (REHEARSAL)" \
  --body "Cycle should call \`launchNativeToken\` with rehearsal config. devBuyEth=0.00025 (~\$1 at ETH=\$4000). idem=rehearsal-001." \
  --label orbit:approval
```

Approve it (as the configured `ORBIT_OWNER_USERNAME`):

```bash
gh issue comment <issue-num> --body "APPROVE ORBIT-LAUNCH rehearsal-001"
gh issue edit <issue-num> --add-label orbit:approved
```

Force a cycle to pick up the approval:

```bash
gh workflow run orbit-cycle.yml
```

Watch the cycle log. Expect:
- D-018 gate passes (`state.preLaunchVerified === true`)
- `launchNativeToken` builds the Clanker v4 transaction, signs, broadcasts
- Token address appears in proof.steps[]
- Cast queued (`milestone` template)

Confirm on Basescan that the contract is deployed and the deployer key has $1 of TOKEN supply minted.

---

## 7. Execute the $0.5 buyback via approval issue

Note: the 4-decimal floor in `src/agent/buyback.js:94` means the minimum legal `wethAmount` is `"0.0001"` (~$0.40 at ETH=$4000). Choose `"0.0002"` (~$0.80) so it clears slippage and rounds up cleanly — calling this "$0.5 demo" is fine.

```bash
gh issue create \
  --title "[orbit buyback] propose 0.0002 WETH (REHEARSAL)" \
  --body "Cycle should call \`proposeBuyback\` with wethAmount=\"0.0002\". idem=rehearsal-buyback-001." \
  --label orbit:approval

gh issue comment <issue-num> --body "APPROVE ORBIT-BUYBACK rehearsal-buyback-001"
gh issue edit <issue-num> --add-label orbit:approved
gh workflow run orbit-cycle.yml
```

Cycle should swap 0.0002 WETH for the rehearsal token via the standard router. Confirm on Basescan: tx exists, recipient is `ORBIT_TREASURY_ADDRESS`, non-zero token amount received.

---

## 8. Verify proofs externally

Pick one proof from §6 (launch) and one from §7 (buyback). For each:

```bash
gh api repos/<owner>/orbit-rehearsal/contents/runtime/proofs/<date>/<file>.json \
  --jq '.content' | base64 -d > proof.json

npx @orbithouse/verifier proof.json --signer <ORBIT_AGENT_SIGNER_ADDRESS>
# Exit 0 = signature verified against the agent signer.
```

If npm publication of `@orbithouse/verifier` isn't done yet, run it locally instead:

```bash
node /home/asuran/Downloads/orbit/packages/orbit-verifier/cli.js proof.json --signer <ORBIT_AGENT_SIGNER_ADDRESS>
```

---

## 9. (Optional, if `MerkleAnchor` is deployed) Verify the on-chain anchor

The Merkle anchor lives in `packages/orbit-anchor/contracts/MerkleAnchor.sol`. If the rehearsal exercises it, read back the window:

```
On Basescan → MerkleAnchor → rootForWindow(<windowEnd_unix_seconds>)
```

Should return a non-zero root + leafCount matching the cycle's off-chain calculation.

---

## 10. Rehearsal close-out

Record the result in `PLAN/STATUS.md` on the **mothership** (this public repo):

```
REHEARSAL CLOSED: <date>
Launch tx:  https://basescan.org/tx/<hash>
Buyback tx: https://basescan.org/tx/<hash>
Proofs verified: yes
```

Then on the rehearsal repo:

```bash
gh repo archive <owner>/orbit-rehearsal --yes
```

**Do NOT delete the rehearsal repo.** Its proofs are the audit trail of the rehearsal — preserve them.

Reset the public repo's `memory/state.json` `preLaunchVerified = false` if you flipped it during testing (it should still be `false` if you've only been working on the rehearsal repo). The public repo's own 12-hour clean-cycle observation begins next.

---

## 11. After rehearsal closes — what unblocks

- ✅ S-GATE-1 #6 (closed-loop demo run successfully once) → can be marked MET in `PLAN/SGATE_1.md`.
- ✅ Adopter program (`PLAN/ADOPTERS.md`) → gitty bootstrap can begin per the adopter plan.
- ⏳ Public repo's own 12-hour clean-cycle observation → still required before the *public* `preLaunchVerified` flips.

---

## What can go wrong, and the right reaction

| Symptom | Diagnosis | Reaction |
|---|---|---|
| Cycle fails on first run | Missing var/secret; bad RPC; AI key wrong | Read `gh run view --log`, fix env, re-run |
| Cycle exits with "Approval required" on routine work | `ORBIT_DRY_RUN` still `true` or `ORBIT_COMMIT_CHANGES` `false` | Fix vars, re-run |
| D-018 gate refusal at §6 | `state.preLaunchVerified` not actually `true` in committed `memory/state.json` | Re-verify the PR landed, force a cycle |
| Buyback proposed but no on-chain swap | `wethAmount` below the 4-decimal floor, OR slippage exceeded | Bump to `"0.0002"`; check pool liquidity |
| Verifier exits non-zero | Signer mismatch, payload tampering, or stale signature scheme | Confirm `ORBIT_AGENT_SIGNER` address matches the key used to sign |
| Proof not produced | `ORBIT_WALLET_PRIVATE_KEY` unset or `agentSigner` empty | Re-set secret, force a cycle |

If anything more serious surfaces (e.g., a token contract deploys to a different chain than Base, or the swap routes to a wrong pool), **stop**, open an issue on the rehearsal repo, do not retry. The whole point of the rehearsal is to surface these silently before the public launch.
