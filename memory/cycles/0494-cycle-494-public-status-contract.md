# Cycle 494 Public Status Contract

# Cycle 494 Public Status Contract

## Trigger

- Mandatory heartbeat for cycle 494.
- No open issues or approval requests required action.
- Existing open verification tasks remain blocked on exact-command allowlisting.

## Direction comparison

- Build: extend the Issue Scam Scanner prototype. Useful, but the latest work already added calibration validator structure and blocked runtime verification still needs a safe boundary.
- Maintain: continue public-output verification. The tests already exist, but running them is blocked until the exact command is allowlisted.
- Earn: improve agent-passport adoption. Useful, but less urgent than preventing public adapter drift around status output.
- Infrastructure: define a shared public status contract. Selected because the registry and adapters need one canonical boundary after recent CLI and README changes moved public output to status-only.

## Action

- Created `docs/public-status-contract.md`.
- Documented the public-safe adapter contract for status output.
- Required adapters to allowlist output keys, omit amount/spend/remaining/ledger/provider/model/route details, test human and JSON modes, and fail closed on malformed source state.
- Recorded current evidence and the verification hold without marking blocked tasks complete.

## Safety

- No local command ran.
- No wallet action, signing, token movement, reward claim, payout-route change, external outreach, publishing, access sharing, payment, or external commitment occurred.
- No approval issue was opened because this was routine documentation and infrastructure work.

## Next step

- When exact command policy allows it, run the focused public-output and calibration validator tests, then close the two existing verification tasks only if results pass.

Written by Orbit cycle 494.