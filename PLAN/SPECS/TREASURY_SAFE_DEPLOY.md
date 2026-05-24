# SPEC — Treasury Safe Deploy Runbook (S-008)

Status: ready-to-execute (owner-driven, not automated)
Refs: D-004 (Safe is 2-of-3 on Base), D-014 (no on-chain action without approval+receipt), D-017 (Treasury Safe + Operator only), D-018 gate item 7
Cross-refs: `PLAN/DEPLOY_PLAN.md` (Wallet section + env var inventory + orbit.horse specifics), `PLAN/CLANKER_FEE_STRATEGY.md`, `.github/workflows/orbit-cycle.yml`

> Orbit cannot deploy a Safe. The owner does it, by hand, once. This document is the script. Follow it top to bottom. Do not skip the verification checklist in section 5 — D-018 gate item 7 is not "Safe deployed", it is "Safe deployed AND funded AND recorded AND verified".

---

## 0. What this delivers

- A 2-of-3 Gnosis Safe on Base mainnet named "Orbit Treasury".
- Four repo-side env values set (one of which is a Variable, three are Secrets).
- One test multisig transaction confirmed on Basescan as a smoke check.
- D-018 gate item 7 (Treasury Safe deployed and funded on Base) eligible to be marked met. Items 1-6 and 8 still independently gate launch — see DECISIONS.md D-018.

This does **not** deliver: token deploy, fee config, buyback wiring, or any tx beyond Safe creation + a self-test. Those happen later, separately.

---

## 1. Preconditions

Before touching `app.safe.global`, confirm every line below is true:

- [ ] At least one signer identity is a **hardware wallet** (any reputable hardware wallet — Ledger, Trezor, GridPlus, Keystone are all fine; the choice is not the point, the air-gap is). This is signer #1.
- [ ] Signer #2 is decided. Acceptable low-cost options:
  - A second hardware wallet of a different brand (defends against vendor-specific firmware bugs)
  - A co-signer's hardware wallet (separation across people, not just devices)
  - A passphrase-protected hardware wallet seed stored in a different physical location
- [ ] Signer #3 is decided. Acceptable low-cost options:
  - A third hardware wallet held in cold storage (safe-deposit box, fireproof safe at a different address)
  - A trusted secondary identity (spouse / co-founder / lawyer-on-record) on their own hardware wallet
  - A recovery-only signer kept offline for the rare break-glass case (do not use it for routine signing)
- [ ] The three signer addresses are written down on paper, with which physical device holds each. (Do **not** record private keys or seed phrases anywhere — only the public 0x addresses.)
- [ ] Owner has **~0.1 ETH on Base** in a hot wallet that can be connected to Safe{Wallet}. Rough cost note: Safe deploy on Base typically lands in the few-dollars range at normal gas, well under 0.05 ETH; the rest funds the Safe itself plus a buffer.
- [ ] Owner has a working **Base RPC endpoint** (Alchemy, QuickNode, public Base RPC — any is fine; only used to verify reads).
- [ ] Repo → Settings → Secrets and variables → Actions panel is open in a separate browser tab, ready to paste values into.
- [ ] You have read D-004, D-014, D-017, and D-018 in `PLAN/DECISIONS.md` within the last 24 hours.

If any line is unchecked, stop here and resolve it before continuing.

---

## 2. Step-by-step deploy via Safe{Wallet} UI

Reference: `https://app.safe.global/`. (Bookmark this. Do not use Safe links sent by anyone, ever.)

1. Open `https://app.safe.global/` in a fresh browser session. Verify the TLS lock and the exact domain spelling (safe.global, not safe-global.com or similar).
2. Click **Connect wallet**. Connect the hot wallet that holds your ~0.1 ETH on Base. This wallet is the *deployer*, not a signer — it pays gas but does not need to be one of the three Safe owners.
3. Switch the network selector to **Base** (chain id 8453). The Safe{Wallet} UI labels it "Base".
4. Click **Create new Safe**.
5. **Name** field: enter `Orbit Treasury`. This is local-only label, helpful for the UI; it has no on-chain effect.
6. **Network**: confirm **Base** is selected. Do not proceed if it shows Ethereum mainnet, Polygon, Optimism, Arbitrum, or any testnet. (Deploying to the wrong network is the single most common Safe-setup error. See section 8 for rollback.)
7. **Owners (signers)**: add three addresses.
   - Click "Add another owner" twice so you have three rows.
   - For each hardware wallet signer: connect the hardware wallet briefly (read-only is fine), copy its address from the device's display or from your hardware-wallet companion app, and paste it into the row. Verify the first four and last four characters against the device screen byte-for-byte. Address-substitution malware exists; the device screen is the source of truth.
   - For a co-signer's hardware wallet: ask them to send you the address through two independent channels (e.g., signal + email), confirm both match, then paste.
   - Optionally label each owner inside the UI (e.g., "Primary HW", "Backup HW", "Recovery"). Labels are local, never on-chain.
8. **Threshold**: set to **2 out of 3**. Per D-004 this is the minimum and the launch configuration. Do not set 1/3 (no quorum) or 3/3 (any signer loss bricks the Safe).
9. Review screen: confirm
   - Network: Base
   - 3 owners listed, addresses match your paper record exactly
   - Threshold: 2
   - Deployer (transaction signer) is the hot wallet you connected, not one of the owner devices unless you intend it
10. Click **Create**. Confirm in your connected wallet. Pay gas. Wait for the tx to confirm on Base (usually under 30 seconds).
11. Once the dashboard loads, copy the new **Safe address**. It is shown at the top of the UI and is also visible as the `to` address on the deployment tx in your connected wallet's history.
12. Open Basescan: `https://basescan.org/address/<safe-address>`. Confirm:
    - The contract is verified as a Safe proxy.
    - The "Read as Proxy" tab exposes `getOwners()` returning your three addresses.
    - `getThreshold()` returns `2`.

If any of step 12's checks fails, stop. Do not fund. Re-deploy.

---

## 3. Funding

1. From any wallet with ETH on Base (the deployer is fine), send **0.1 ETH** to the new Safe address. Use the address you copied from Safe{Wallet} — not from email, chat, or a screenshot.
2. Wait for confirmation on Basescan.
3. Refresh the Safe{Wallet} UI. The Assets tab should show 0.1 ETH.
4. Refresh Basescan. The "Balance" field on the Safe address should show 0.1 ETH.

Why 0.1: enough for the test tx in section 5, enough for the eventual Clanker admin handoff tx, enough to absorb a few rounds of gas spikes without re-funding. The Safe will later receive WETH from the Clanker fee locker — that is a separate flow (D-017) handled in S-014+, and is not part of this runbook.

---

## 4. Record into repo secrets

Open Repo → Settings → Secrets and variables → Actions. Note the panel has two tabs: **Secrets** and **Variables**. Per `.github/workflows/orbit-cycle.yml`, the four values below are split:

| Name | Tab | Value to paste |
|---|---|---|
| `ORBIT_TREASURY_ADDRESS` | **Secret** | The Safe address from section 2 step 11 |
| `ORBIT_TOKEN_ADMIN_ADDRESS` | **Secret** | The **same** Safe address (admin = Treasury Safe per D-017) |
| `ORBIT_OPERATOR_REVENUE_ADDRESS` | **Secret** | The **founder EOA** address (operator share recipient — a separate address, never a Safe signer; see section 6) |
| `ORBIT_OPERATOR_REVENUE_BPS` | **Secret** | `500` (per D-017: 500 bps of creator share = 5%) |

Verification:

- After saving, the Secrets tab lists all four names with "Updated <timestamp>". Values are not re-readable — that is correct.
- The classification matches `.github/workflows/orbit-cycle.yml` lines 63-66, where all four are referenced as `${{ secrets.X }}`. If you accidentally set one as a Variable, the workflow will pass an empty string and cycles will surface a config error.

Do **not**:
- Commit any of these addresses to source control. Per `DEPLOY_PLAN.md` § Wallet Section: "No wallet address in source control."
- Store the operator EOA's private key in any GitHub secret. Operator revenue is *received* by that EOA; the EOA's key is the founder's, off-platform.

---

## 5. Verification checklist

Tick every box before declaring the Safe "ready" and updating STATUS.md. Eight checks; all required.

- [ ] Safe address resolves on Basescan and the contract is recognised as a Safe proxy.
- [ ] Safe owner list (`getOwners()` on Basescan or the Settings tab in Safe{Wallet}) shows **all three** configured signer addresses, byte-for-byte matching the paper record from section 1.
- [ ] Threshold = **2** (`getThreshold()` returns 2; Safe{Wallet} Settings → Required confirmations shows "2 out of 3").
- [ ] Safe balance > 0 ETH on Base (0.1 ETH per section 3).
- [ ] Each of the three signers has independently opened `https://app.safe.global/`, connected their signing device, and confirmed they can see the Orbit Treasury Safe in their owned-Safes list. (Asking each signer to text "I see it" closes this loop.)
- [ ] All four repo-side values from section 4 are set in GitHub (three Secrets + one Secret for BPS = four Secrets total).
- [ ] One test transaction completed end-to-end: signer A proposes a 0.01 ETH transfer from the Safe back to the Safe itself, signer B confirms, the tx executes on Base, and the receipt is visible on Basescan.
- [ ] Test tx hash recorded here: `0x________________________________________________________________` (paste before marking section complete).

If any box is unchecked, the gate is not met. D-018 gate item 7 stays open.

---

## 6. Threat-model checklist

Independent of section 5's functional checks. Tick all four before treating the Safe as production custody.

- [ ] **Physical separation of signing keys.** No two of the three signing devices live in the same building. If primary HW and backup HW are both in the same drawer, a single burglary or fire compromises the quorum. Move one.
- [ ] **No recovery phrase on a connected device.** Seed phrases live on paper, metal, or in a sealed analog backup — never in a password manager that syncs to the cloud, never in a screenshot, never in a notes app. If any signer's seed is on a device that touches the internet, rotate that signer (section 8) before any real funds enter.
- [ ] **Operator EOA is not a Safe signer.** The address you used for `ORBIT_OPERATOR_REVENUE_ADDRESS` must not appear in `getOwners()`. Separation of duties: the operator receives a small weekly stream; the Safe controls treasury. Collapsing them re-creates single-key custody for the largest position.
- [ ] **At least one signer is on hardware.** Per the preconditions in section 1 this is signer #1; confirm here that the address you registered as owner #1 in step 7 is in fact the hardware wallet's address and not, say, a MetaMask hot wallet you used to test with.

If any of these is unchecked, the Safe technically works but its threat model is degraded. Resolve before funding above 0.1 ETH or treating the Safe as launch-ready.

---

## 7. What happens after S-008 closes

- **D-018 gate item 7** ("Treasury Safe is deployed and funded on Base") may be marked met in `STATUS.md`. Move the line item from open to closed; reference the Safe address by env-var name only (`ORBIT_TREASURY_ADDRESS`), not by literal address.
- **D-018 gate items 1-6 and 8 remain open.** Specifically: health check clean (1), tests passing (2), AI provider verified (3), 12-hour clean cycle window (4), signed-proof verifier shipped (5), public dashboard live (6), pre-deploy checklist in CLANKER_FEE_STRATEGY checked (8). Re-read D-018 in `PLAN/DECISIONS.md` for the canonical list.
- `ORBIT_ENABLE_TOKEN_LAUNCH` stays `false` until every D-018 item is met. The Safe being live does not unlock launch on its own.
- The Safe address may now be referenced in any in-cycle approval issue text (e.g., "transfer admin to `ORBIT_TREASURY_ADDRESS`"), but per D-014 no on-chain action follows until the approval issue is signed off by the owner and the resulting receipt is signed.
- `DEPLOY_PLAN.md` Wallet section row "Treasury Safe" updates its Status implicitly — do not edit the address into that table. The env var name is sufficient.

---

## 8. Rollback / contingency

### 8.1 A signer key is compromised (suspected leak, lost device with known PIN, social-engineered backup)

Use Safe{Wallet}'s owner-management flow. This is a normal Safe tx and requires the 2-of-3 quorum to execute.

1. The remaining two un-compromised signers open `https://app.safe.global/`.
2. Settings → Setup → Owners → "Replace" on the compromised owner row. Enter the new owner address (a freshly-generated hardware-wallet address; do not reuse any address that ever appeared on a compromised machine).
3. Signer A proposes; signer B confirms. The replace executes as a single multisig tx. The compromised owner can no longer participate even if they still hold their key.
4. Update section 1's paper record with the new address.
5. If the compromised signer is in fact two of the three (a worst-case event), the Safe cannot recover without coordinating with Safe Labs and is effectively lost. Reduce blast radius beforehand by following section 6.

No env vars change in this rollback — `ORBIT_TREASURY_ADDRESS` is the Safe itself, which does not change when owners rotate.

### 8.2 Safe was deployed to the wrong network

If you deployed to Ethereum mainnet, Optimism, Arbitrum, Polygon, a testnet, or anywhere other than Base mainnet:

1. Do not panic. The deploy cost a few dollars of gas; nothing else is lost.
2. Do not fund the misplaced Safe further. Withdraw anything you accidentally sent in.
3. Return to section 2 step 3 and redeploy on Base.
4. Update the value in `ORBIT_TREASURY_ADDRESS` and `ORBIT_TOKEN_ADMIN_ADDRESS` (both Secrets) to the new Base Safe address. Old value can be discarded.
5. Because no token has been deployed yet and Clanker fee config has not been written, there is no on-chain config to update. Per D-017 the Treasury Safe address is referenced only when Clanker is deployed (later session). Updating the env vars before that point is sufficient.

### 8.3 Lost access to one signer, two remain

The Safe is operational on the 2-of-3 quorum. Treat it as section 8.1: use the two-signer quorum to replace the lost owner with a fresh address.

### 8.4 Lost access to two signers

The Safe is bricked. Any funds in it cannot be moved. This is why section 6's physical-separation check exists. If it happens before token deploy: redeploy a new Safe (section 2), update secrets (section 4), move on — only 0.1 ETH is at risk. If it happens after fee accrual has begun: irrecoverable; treat as a total loss event and refer to the broader incident process (out of scope for this runbook).

---

## 9. Change log for this spec

| Date | Session | What changed |
|---|---|---|
| 2026-05-24 | S-008 | Initial runbook. 2-of-3 on Base; four-secret repo wiring; eight-item verification checklist; four-item threat checklist; rollback paths for the four most likely failure modes. |
