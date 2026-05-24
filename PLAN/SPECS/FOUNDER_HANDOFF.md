# FOUNDER_HANDOFF.md — Founder Handoff Narrative (S-035)

## 1. Goal

A public cycle in which the founder reduces their direct control — rotating Safe signer share, lowering approval-list privileges — and Orbit casts about it. This is BOTH a technical change AND a narrative event. The handoff is a trust artifact; it MUST be reversible only through the multi-maintainer quorum (per S-029/S-030), never unilaterally.

## 2. Constraints

- github-only — no off-platform legal agreement required for the handoff
- No on-chain action without approval per **D-014**
- Token-launch hard-block per **D-018** — handoff cannot happen before Phase 4 (≥50 adopter repos)
- Handoff CANNOT BE REVERSED by the founder alone — requires quorum + 7-day timelock
- Multi-maintainer quorum (S-029) MUST be live before handoff begins
- Handoff is gradual, not single-event: founder share reduces over multiple cycles

## 3. Scope

In:
- Technical: Safe signer rotation (founder → new signer chosen by quorum)
- Gradual reduction of founder-only privileges (specifically `ORBIT_OWNER_USERNAME` in env shifts from solo founder to a maintainer list, with quorum approving the change)
- Narrative: cast template, lore/cycles-of-note entry, signed proof anchoring the handoff
- 7-day timelock between proposal and execution
- Multiple-handoff support (handoff to a successor, who can later handoff again)

Out:
- Founder ABANDONMENT (the framing is institutional maturation)
- Full key surrender at once (gradual)
- External legal agreements (the on-chain action IS the agreement)
- Reversibility by founder alone (never)

## 4. Design

### Handoff lifecycle states
0. handoff.proposed — founder OR any maintainer opens proposal issue
1. handoff.voting — quorum members vote APPROVE/REJECT via comments (S-029 pattern)
2. handoff.timelock — quorum reached; 7-day timer starts; anyone can comment to extend timer one time (+7d) for due diligence
3. handoff.executing — timelock expired; on-chain Safe signer rotation tx; founder's APPROVE-prefix removed from cycle-config; new ORBIT_OWNER_USERNAME or ORBIT_MAINTAINERS updated
4. handoff.complete — signed cycle proof anchors the change; cast posted; lore entry written

### Approval issue body template
```
**Founder handoff proposal**

Type: {signer-rotation | maintainer-list-change | privilege-reduction}
From: {currentSigner / currentMaintainers}
To: {proposedSigner / proposedMaintainers}
Effective: after 7-day timelock from quorum reach
Quorum threshold: {threshold}/{totalMaintainers}

Rationale: {rationale}

To approve: comment `APPROVE ORBIT-HANDOFF {idem}` on its own line.
To reject: `REJECT ORBIT-HANDOFF {idem}` on its own line.
To extend timelock once: `EXTEND ORBIT-HANDOFF {idem}` once timelock has started.
```

### Cast template
```
cycle #{n} · founder share reduced

today the founder steps back from {what}. the safe now requires
{newThreshold}-of-{newSigners} for any action. the founder is one
signer among {n}.

this was approved {threshold}-of-{n} on {date}. the timelock ran
for {days} days. anyone could have rejected.

receipt: {receiptUrl}
proposal: {proposalUrl}
```
(Lowercase, in-voice, no exclamation marks.)

### lore/cycles-of-note entry
Mandatory markdown file at `lore/cycles-of-note/handoff-{n}.md`. Contents:
- Cycle number
- Cycle date
- One paragraph in Orbit's voice describing the handoff
- Links to: proposal issue, approval cycle proof, the on-chain tx hash

## 5. D-014 + D-018 Alignment

| Decision | Application |
|---|---|
| D-014 | Every handoff step is approval-gated. The on-chain Safe rotation requires explicit signer signoff. |
| D-018 | Handoff cannot happen before D-018 #4 closed AND Phase 4 criterion "≥50 adopter repos" met. |

## 6. Failure Modes

1. Quorum reached but timelock-extender abuses extension → spec limits extension to one use; second EXTEND comment ignored.
2. Founder tries to reject post-quorum → founder REJECT post-approval is ignored; the rejection had to come during voting.
3. New signer key turns out compromised → next handoff proposal proceeds normally; existing handoff is not auto-reverted (irreversibility is the property).
4. Safe rotation tx fails on-chain → handoff stays in handoff.executing; next cycle retries; if 3 failures, escalate to manual intervention via dispute issue.
5. Founder tries to handoff to themselves under a different alias → maintainer list change must include a new identity that is independently verifiable (e.g., distinct GitHub account with N-day history); proposal must declare the recipient identity; quorum can reject.
6. Quorum is captured (e.g., founder controls 2 of 3 signer keys) → mitigated by D-018 prerequisite that ≥50 adopter repos exist; bad-faith quorum becomes publicly visible and adoption-damaging.

## 7. Test Plan (future)

- Lifecycle transitions deterministic
- Timelock cannot be skipped
- Extension allowed once and only once
- REJECT during voting blocks further progress
- REJECT after quorum reached is ignored
- Signer rotation tx is approval-gated (no rotation without explicit `APPROVE ORBIT-HANDOFF` comment from quorum threshold)
- D-018 enforcement: handoff refuses to start when `state.preLaunchVerified !== true` or `adopterCount < 50`

## 8. Open Questions

- What's the right cadence for partial handoffs? Annual? Tied to milestones?
- Should the original founder retain veto power for emergencies (e.g., a "founder breakglass" key)? Decided: NO. Breakglass is anti-handoff.
- How do we surface to the broader community that handoff happened cleanly? The cast template + lore entry + the cycle proof together form the audit trail.

## 9. Cross-References

- `PLAN/SPECS/MULTI_MAINTAINER_QUORUM.md` (prerequisite — quorum must be live)
- `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md` (Safe signer rotation mechanics)
- `lore/cycles-of-note/README.md` (where handoff entries land)
- `PLAN/DECISIONS.md` — D-014, D-017 (Safe holds treasury — admin transferable only via Safe vote), D-018
