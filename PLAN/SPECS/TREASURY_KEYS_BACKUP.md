# TREASURY_KEYS_BACKUP.md — Multi-Sig Signer Setup and Recovery

> Operational runbook for setting up, backing up, and rotating the signer keys behind the 7 Safe multisigs defined in `PLAN/SPECS/TREASURY_ALLOCATION.md`. **This document is the disaster-recovery contract.** If any of the Treasury Safes ever needs to be recovered after a lost device, you read this and execute it.

This file does **not** contain seed phrases, addresses, or private keys. It contains the **procedure**. Actual sensitive material lives in physical storage per §4 below.

---

## 1. Topology

Per D-019 there are 7 Safes total on Base mainnet:

| # | Safe | Threshold | Notes |
|---|---|---|---|
| 1 | Fee Receive Safe | 2/3 | Transit account; drained weekly via sweep |
| 2 | Floor Reserve Safe | 2/3 | Long-term price-floor anchor. Highest stakes. |
| 3 | Productive Yield Safe | 2/3 | Deploys to Aave/Uniswap; recoverable from venues |
| 4 | Buyback Safe | 2/3 | Funds weekly buyback (D-005) |
| 5 | Growth Safe | 2/3 | Mission rewards + adopter incentives + bounty matches |
| 6 | AI Costs Safe | 2/3 | Reimburses operator monthly for AI invoices |
| 7 | Operations Runway Safe | 2/3 | Gas, RPC, infra contingency |

**Why 2/3, not 3/3:** 3/3 maximizes attacker friction (need all 3 keys) but minimizes survivability (lose 1 key → funds locked forever). For solo operation, 2/3 is the right balance: an attacker still needs 2 of 3 keys (high friction), and you can recover from a single device loss.

**Why not 3/5 or larger:** 3/5 is appropriate when you have 5 distinct trustees (team / family / lawyer). For a solo founder, 3 distinct devices in 3 distinct locations is the operationally manageable maximum. Going to 5 devices adds key-management overhead without meaningful security gain.

---

## 2. Signer device setup

Each Safe has **3 owner addresses**, each backed by a distinct device. Use the same 3 devices across all 7 Safes — same signer set, same threshold. This is intentional: separate signer sets per Safe would multiply key-management to unmanageable levels.

**Required hardware:**

| Device slot | Recommendation | Why diversity matters |
|---|---|---|
| Signer A | Ledger (Nano X / Stax) | Most-audited firmware, broad ecosystem support |
| Signer B | Trezor (Model T / Safe 5) | Different vendor; firmware independence |
| Signer C | GridPlus Lattice1 OR a paper wallet | Different vendor again; or air-gapped paper for cold storage |

Avoid: 3 of the same vendor (e.g., 3 Ledgers). A supply-chain compromise of one vendor would compromise all 3 keys.

**Initialization steps (each device):**

1. Initialize device offline. **Do not** restore from a seed copied from another device — generate fresh.
2. Write the 24-word seed phrase on paper or metal (Cryptosteel / similar). **Do not photograph, do not type into a computer, do not store in a password manager.**
3. Create one Ethereum address per device. Record only the **address** (public, OK to share). Seed phrase stays on paper.
4. Power off the device when not in use. Hardware wallets are not laptops.

Result: 3 addresses (e.g., `0xAAA…`, `0xBBB…`, `0xCCC…`), 3 backed-up seed phrases, 3 physical devices.

---

## 3. Safe deployment

For each of the 7 Safes:

1. Go to https://app.safe.global on Base mainnet
2. Create new Safe
3. Add the 3 signer addresses (A, B, C) as owners
4. Set threshold to 2
5. Deploy (one-time gas cost ~$5–$15 per Safe)
6. Record the Safe address. Store it in:
   - `memory/treasury.json.buckets[*].address` (under the matching bucket id)
   - The corresponding repo secret (e.g., `ORBIT_FLOOR_RESERVE_SAFE`)
   - This runbook's §6 table below (per Safe)

Test deployment: send 0.0001 ETH from a personal wallet to the Safe, then propose+execute a self-transfer back. If the multisig flow works end-to-end, the Safe is good. Repeat for all 7.

---

## 4. Backup storage

For each of the 3 signer seed phrases:

**Primary backup** — original Cryptosteel / engraved metal plate. Stored at primary residence in a fireproof + waterproof container.

**Secondary backup** — handwritten copy or second metal plate. Stored at a different physical location: safe deposit box, trusted family member's home, or attorney's office. **Never on cloud storage. Never in a password manager. Never photographed.**

**Tertiary backup (optional, recommended)** — Shamir Secret Sharing splits of the seed (3-of-5 SLIP-39 if supported by the wallet). Each shard stored separately. Allows reconstruction without any one location holding the full key.

**Backup verification (annual):**

Once per year, verify each backup is readable and the seed phrase still recovers to the expected address:

```
1. Power on a fresh / wiped device
2. Restore from the backed-up seed phrase
3. Confirm the first derived Ethereum address matches the recorded address
4. Wipe the device
5. Re-store the seed phrase in its backup location
```

Skip a year and you don't know if your backup is corrupt until you need it.

---

## 5. Recovery scenarios

### Scenario A: Single device lost or destroyed

- Funds are **safe**. 2/3 threshold means the remaining 2 devices can still sign.
- Action: replace the lost device. Set up a fresh hardware wallet with a new seed (do NOT restore the lost device's seed onto the replacement). Get its address.
- For each of the 7 Safes: propose owner swap (remove lost device's address, add new device's address). Two existing signers approve. Execute.
- Time required: ~2 hours per Safe (14 hours total across 7).
- Cost: ~$50–$150 gas total.

### Scenario B: Two devices lost simultaneously

- Funds are **stuck**. 2/3 threshold means at least 2 owners must sign; only 1 remains.
- Action: this is why you have backups. Restore one of the lost seeds onto a fresh device (use the secondary or tertiary backup). Once restored, scenario A applies.
- If both lost devices' backups are also unrecoverable (catastrophic — fire AND independent loss): funds are gone. This is why §4 tertiary backups exist.

### Scenario C: Single device compromised (attacker has key)

- Funds are **at risk**. Attacker has 1 of 3 signatures; they need 1 more to drain a Safe.
- Action (urgent, hours not days): use the remaining 2 honest signers to propose owner removal of the compromised device's address. Replace with a fresh address generated on a clean device. Execute on all 7 Safes.
- Then change Operations operationally: rotate any other secrets (RPC keys, AI keys) that may have been on the compromised system.

### Scenario D: Operator (you) becomes incapacitated

- Per `PLAN/SPECS/FOUNDER_HANDOFF.md` (S-035), the founder-handoff narrative covers institutional transition. Operationally:
  - 3 signer seed phrases + this runbook are stored such that a designated successor can retrieve them. Storage location is documented in a separate sealed envelope held by an attorney or trusted family.
  - Successor uses the seed phrases to restore 2/3 signing capability and then transfer Safe ownership to a new signer set per scenario A.
- This is the "Phase 5 founder fade" mechanic at the key-management layer.

---

## 6. Safe inventory (filled in by owner during deployment)

| # | Bucket | Safe Address | Deployed | Last verified |
|---|---|---|---|---|
| 1 | Fee Receive | `0x____` | `____` | `____` |
| 2 | Floor Reserve | `0x____` | `____` | `____` |
| 3 | Productive Yield | `0x____` | `____` | `____` |
| 4 | Buyback | `0x____` | `____` | `____` |
| 5 | Growth | `0x____` | `____` | `____` |
| 6 | AI Costs | `0x____` | `____` | `____` |
| 7 | Operations Runway | `0x____` | `____` | `____` |

Signer set (same across all Safes):

| Slot | Hardware | Address |
|---|---|---|
| A | Ledger | `0x____` |
| B | Trezor | `0x____` |
| C | GridPlus / paper | `0x____` |

Seed phrase storage locations (record only, never the phrases themselves):

| Seed | Primary location | Secondary location | Tertiary (optional) |
|---|---|---|---|
| Signer A | `____` | `____` | `____` |
| Signer B | `____` | `____` | `____` |
| Signer C | `____` | `____` | `____` |

---

## 7. Rotation cadence

- **Devices:** keep until firmware deprecation or visible damage. No fixed expiry.
- **Backup verification:** annual (see §4). Log the verification date in §6.
- **Address rotation:** only on compromise (Scenario C) or scheduled handoff (Scenario D). Routine rotation is not recommended — it introduces avoidable risk.
- **This runbook:** review annually. Update the inventory and verification dates. Push corrections to git.

End of runbook.
