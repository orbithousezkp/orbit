# Orbit env vars. Copy to .env and fill in. Do not commit .env.
# All values here are placeholders. Real secrets live in GitHub Secrets and Variables.

# AI inference (GitHub Secrets)
ORBIT_AI_PROVIDERS=
ORBIT_AI_PROVIDER_KEYS=

# AI budget caps (GitHub Variables)
ORBIT_AI_DAILY_BUDGET_USD=
ORBIT_AI_MONTHLY_BUDGET_USD=

# Owner identity and approval (GitHub Variables)
ORBIT_OWNER_USERNAME=
ORBIT_APPROVAL_ISSUE_LABEL=
ORBIT_APPROVAL_ACCEPTED_LABEL=
ORBIT_APPROVAL_REJECTED_LABEL=

# Lifecycle flags (GitHub Variables)
ORBIT_DRY_RUN=
ORBIT_COMMIT_CHANGES=
ORBIT_PUSH_CHANGES=
ORBIT_ALLOW_COMMANDS=

# Cycle signer — wallet private key used ONLY for signing cycle
# proofs (D-006). Adopters do not ship a token-launch surface; if
# you want to launch a token from your repo, you are on your own
# and not supported by the upstream project (D-020).
ORBIT_WALLET_PRIVATE_KEY=

# Agent signer public address (GitHub Variable) — must match the
# private key above. Verifiers refuse proofs whose signer does not
# match.
ORBIT_AGENT_SIGNER=

# Farcaster casting (GitHub Secrets and Variables)
ORBIT_FARCASTER_NEYNAR_API_KEY=
ORBIT_FARCASTER_SIGNER_UUID=
ORBIT_FARCASTER_FID=
ORBIT_FARCASTER_DRY_RUN=

# Dashboard public URL (GitHub Variable)
ORBIT_PUBLIC_URL=
