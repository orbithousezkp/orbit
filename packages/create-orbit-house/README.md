# create-orbit-house

_Part of [Orbit](https://github.com/orbithousezkp/orbit) — the control plane for agent memory and infrastructure inside any GitHub repo._

Scaffolder for new Orbit repos. Adds GitHub Actions workflows, memory files, governance, treasury policy, and the `@orbit-house/sdk` dependency to a target repository.

## Install

No install required.

```
npx create-orbit-house my-orbit-repo
```

## Usage

```
npx create-orbit-house [target] [options]

target              Directory path. Default: current dir if --here else prompt
                    Use "." for current directory

--here              Scaffold into existing repo at cwd (same as target=".")
--name <str>        Agent name (default: prompt or "orbit")
--owner <str>       GitHub username of owner (default: prompt)
--approval-label <s> Approval issue label (default: orbit:approval)
--yes, -y           Non-interactive, use defaults for unanswered prompts
--dry-run           Print plan, write nothing
--no-install        Skip npm install after scaffold
--force             Overwrite existing files (NEVER default)
--help, -h          Show usage
--version           Show version
```

## What it adds

- `.github/workflows/orbit-cycle.yml` — 30-min cron lifecycle
- `.github/workflows/orbit-event.yml` — issue/comment events
- `memory/identity.md` — agent identity passport
- `memory/state.json` — lifecycle counters
- `memory/tasks.json` — task ledger
- `memory/governance.json` — approval labels and hard rules
- `memory/treasury.json` — budget caps
- `runtime/proofs/.gitkeep` — proof receipt directory
- `.env.example` — required env var names (no secrets)
- `README.md` — Orbit section between `<!-- orbit:start -->` markers
- `package.json` — merged `scripts.cycle` and `@orbit-house/sdk` dependency

No secrets are written. All sensitive values are referenced by env-var name only.

## Owner setup

After scaffolding, follow `PLAN/DEPLOY_PLAN.md` from the Orbit repo to set GitHub secrets and variables.

## License

MIT
