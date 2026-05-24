# BOUNTY_REFERRAL.md — Bounty Referral Across Orbits (S-026)

## 1. Goal

When a bounty in repo A has no claimant within the deadline window, the bounty can be referred to repo B's claimant pool via a `BOUNTY_REFERRAL` federation message. Repo B's Orbit instance picks it up, surfaces the referral to its readers, and any qualified claimant from repo B can claim. Original bounty contract pays the remote claimant directly; referrer takes a small fee.

## 2. Constraints

- Depends on `FEDERATION.md` (S-021/22/23) — uses same signed-envelope protocol
- Depends on `BOUNTY_MARKET.md` (S-019/20) — extends bounty lifecycle
- No on-chain action without approval per **D-014**
- Token-launch hard-block per **D-018** — referral activates post-S-GATE-2
- Anti-self-referral: referrer cannot route to a wallet they control

## 3. Scope

In:
- New federation message type `BOUNTY_REFERRAL`
- Referrer-fee mechanism (1-5% of bounty)
- Verification: remote claimant proof must verify against both repos' Orbit signers
- Public surface: referred bounties shown in both repos' dashboards

Out:
- Auto-routing — every referral is explicit; no algorithmic matchmaking in v1
- Multi-hop referrals (A→B→C): bounty can be referred once only in v1
- Cross-chain bounties: Base-only in v1

## 4. Design

### Federation message
```json
{
  "version": "1",
  "type": "BOUNTY_REFERRAL",
  "fromRepo": "owner/repo-a",
  "fromSigner": "0x...",
  "sentAt": "2026-10-01T12:00:00Z",
  "nonce": "0x...",
  "payload": {
    "bountyId": "0x...",
    "amount": "1000000000000000000",
    "tokenAddress": "0xORBIT...",
    "escrowContract": "0x...",
    "deadline": "2026-10-15T12:00:00Z",
    "acceptanceCriteria": "...",
    "referrerFeeBps": 300,
    "referrerAddress": "0x..."
  },
  "signature": "0x..."
}
```

### Lifecycle extension (beyond BOUNTY_MARKET.md states 0-9)
- bounty.open → bounty.referred (when referral message sent)
- bounty.referred → bounty.claimed-remote (when remote claimant comments)
- bounty.claimed-remote → bounty.under-review-remote (verifier runs in both repos)
- bounty.under-review-remote → bounty.paid-remote (escrow releases to remote claimant + fee to referrer)
- bounty.referred → bounty.unreferred (timeout, referral expires; bounty reopens to original repo)

### Anti-self-referral check
- Compare `referrerAddress` against bounty `funderAddress` → reject if same
- Compare `referrerAddress` against any signer in `fromRepo`'s memory/identity.json → reject if match
- Compare `claimantAddress` (when claim comes in) against `referrerAddress` → reject if same

## 5. D-014 + D-018 Alignment

| Decision | Application |
|---|---|
| D-014 | Each cross-orbit payout requires an approval issue in BOTH repos — the bounty-owning repo AND the referring repo |
| D-018 | Cross-orbit bounty referral inactive until federation is live (post-S-GATE-2) and bounty market is live (post-S-GATE-3) |

## 6. Failure Modes

1. Referrer's repo gets evicted from peer list mid-referral → bounty unreferred, escrow refunded if no claim landed.
2. Referrer signature invalid → quarantine pipeline drops at step (b); no impact on bounty.
3. Remote claimant fails verifier → bounty.rejected-remote; bounty.referred reopens with one referral exhausted.
4. Fee exceeds 5% cap → message dropped by recipient with `risky_payload:referrer_fee_excessive`.
5. Deadline expires while in bounty.referred → bounty.unreferred; auto-refund per BOUNTY_MARKET.md state 8.

## 7. Test Plan (future)

- Message shape validation rejects bad payloads
- Anti-self-referral catches funder=referrer and claimant=referrer
- Fee cap enforcement (max 500 bps)
- Lifecycle: bounty.open → referred → claimed-remote → paid-remote (happy path)
- Lifecycle: bounty.referred → unreferred on timeout
- Approval gate: both repos' owners must approve the payout

## 8. Open Questions

- Should referrer fees burn or recycle into Phase 4 productive treasury? Defer to S-026 implementation.
- What's the "qualified claimant" definition in the receiving repo? Reputation-based via plugin marketplace (S-033)? Owner-curated? Defer.
- Cross-orbit dispute resolution: who adjudicates if both repos disagree on verification?

## 9. Cross-References

- `PLAN/SPECS/FEDERATION.md` (parent protocol)
- `PLAN/SPECS/BOUNTY_MARKET.md` (extends lifecycle)
- `PLAN/SPECS/PLUGIN_MARKETPLACE.md` (reputation surface)
- `PLAN/DECISIONS.md` — D-014, D-018
