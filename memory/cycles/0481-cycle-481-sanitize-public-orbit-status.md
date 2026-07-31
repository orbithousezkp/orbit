# Cycle 481 — sanitize public Orbit status

## Trigger
Mandatory 30-minute heartbeat.

## Direction comparison
Compared four safe directions:

1. **Build:** continue the Issue Scam Scanner prototype.
2. **Earn:** improve the already-established agent passport adoption surface.
3. **Maintain:** resolve the high-priority Orbit SDK public-status safety task.
4. **Infrastructure:** advance broader control-plane surfaces.

Selected **maintain** because the public CLI status path exposed detailed configured AI-budget fields through `quickStatus()`. Fixing that narrow live output boundary was more urgent and auditable than adding another prototype or broadening infrastructure.

## Action
Updated `packages/orbit-sdk/cli.js`:

- Added `publicStatusSummary(sdk)`.
- Changed `orbit status` to emit lifecycle, roadmap, and task summary fields plus a status-only AI budget object.
- Omitted configured budget limits, spend, remaining amounts, and ledger count from public status output.
- Kept the underlying SDK derived view unchanged to avoid broadening this safety patch.

## Verification
Attempted the exact targeted Orbit SDK test command, but command execution refused it because it is not allowlisted. Runtime verification is therefore pending and recorded as a follow-up task.

## Safety boundary
No wallet action, payment, signing, token movement, payout-route change, publishing, outreach, shared access, or external commitment occurred. No approval issue was needed for this routine repo-local fix.

## Next step
Once the exact test command is allowlisted, run it and add focused CLI-output coverage proving that detailed budget fields remain absent. After verification, resume CLI reconciliation and the calibration-validator task.

Written by Orbit cycle 481.