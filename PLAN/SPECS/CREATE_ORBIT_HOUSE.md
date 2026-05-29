# SPEC — create-orbit-house scaffolder (S-007)

Status: ready-to-implement
Refs: D-009, DEPLOY_PLAN.md env-var inventory

## 1. Package Structure

```
packages/create-orbit-house/
  package.json              # name: create-orbit-house, bin: ./bin.js
  bin.js                    # shebang + argv parser + main()
  src/
    index.js                # orchestrator
    detect.js               # existing-repo + node + git checks
    prompts.js              # interactive prompts (uses readline, no deps)
    writer.js               # safe-write w/ skip-on-exists
    summary.js              # "what got added" output
  templates/
    .github/workflows/orbit-cycle.yml.tpl
    .github/workflows/orbit-event.yml.tpl
    memory/identity.md.tpl
    memory/tasks.json.tpl
    memory/governance.json.tpl
    memory/treasury.json.tpl
    memory/state.json.tpl
    runtime/proofs/.gitkeep
    package.json.partial.json
    README.orbit-section.md.tpl
    .env.example.tpl
  README.md                 # how to use
  LICENSE                   # MIT
```

Zero runtime deps. Node ≥18 (uses native fs/promises, readline/promises).

## 2. Template Files Produced

| Path written into target | Source template | Templated values |
|---|---|---|
| `.github/workflows/orbit-cycle.yml` | orbit-cycle.yml.tpl | `{{NODE_VERSION}}` |
| `.github/workflows/orbit-event.yml` | orbit-event.yml.tpl | none |
| `memory/identity.md` | identity.md.tpl | `{{AGENT_NAME}}`, `{{REPO_URL}}`, `{{OWNER}}` |
| `memory/tasks.json` | tasks.json.tpl | empty `{ "tasks": [] }` |
| `memory/governance.json` | governance.json.tpl | `{{APPROVAL_LABEL}}` (default `orbit:approval`) |
| `memory/treasury.json` | treasury.json.tpl | empty caps placeholder |
| `memory/state.json` | state.json.tpl | `{ "cycle": 0, "born": null, "lastStatus": "unborn" }` |
| `runtime/proofs/.gitkeep` | (verbatim) | none |
| `.env.example` | .env.example.tpl | (placeholder values only) |
| `README.md` (append) | README.orbit-section.md.tpl | `{{AGENT_NAME}}` |
| `package.json` (merge) | package.json.partial.json | adds `scripts.cycle`, `dependencies.@orbithouse/sdk` |

Hard rule: NO secrets, NO addresses, NO private keys in any template. All references are env-var names. Values like `ORBIT_TREASURY_ADDRESS` appear only as identifiers in `.env.example`.

## 3. CLI Argv Parsing

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
--no-install        Skip `npm install` after scaffold
--force             Overwrite existing files (NEVER default)
--help, -h          Show usage
--version           Show version
```

Interactive mode when stdin is TTY AND `-y` not passed. Each prompt has default in brackets; bare Enter accepts.

## 4. Existing-Repo Detection

Before any write, run `detect.js`:

1. Check Node version → fail if < 18
2. Check target dir exists → if no, create (unless target is current with files: ok)
3. Check `.git/` present → if no, warn but proceed (offer `git init` at end)
4. For each template file:
   - If destination exists AND content differs → mark `SKIP` (unless `--force`)
   - If destination exists AND content matches → mark `NOOP`
   - Else → mark `WRITE`
5. Special-case `package.json`:
   - If present, parse, deep-merge our additions, write back. Do not clobber existing scripts/deps.
   - If absent, write minimal with our additions.
6. Special-case `README.md`:
   - If present + contains marker `<!-- orbit:start -->` → skip (already installed)
   - If present, no marker → append between `<!-- orbit:start -->` … `<!-- orbit:end -->`
   - If absent → write fresh.

Conflict policy printed before any write:

```
The following files exist and will be SKIPPED (use --force to overwrite):
  .github/workflows/orbit-cycle.yml  (differs)
```

If `--force` passed AND file differs, write a `.orbit-bak` sibling first, then overwrite.

## 5. Output Summary

```
orbit scaffold complete in ./my-repo

added:
  .github/workflows/orbit-cycle.yml
  .github/workflows/orbit-event.yml
  memory/identity.md
  memory/governance.json
  memory/tasks.json
  memory/treasury.json
  memory/state.json
  runtime/proofs/.gitkeep
  .env.example

merged:
  package.json  (added: scripts.cycle, dependency @orbithouse/sdk)

skipped (already present):
  README.md  (no marker found; add <!-- orbit:start --> to enable merge)

next steps:
  1. cd ./my-repo
  2. npm install            (skipped: --no-install was set)
  3. Set required GitHub secrets:
       ORBIT_AI_PROVIDERS         JSON route list for AI provider
       ORBIT_AI_PROVIDER_KEYS     AI provider API keys
       ORBIT_WALLET_PRIVATE_KEY   Agent signing key
       ORBIT_BASE_RPC_URL         Base RPC endpoint (optional, Phase 2)
  4. Set GitHub variables:
       ORBIT_OWNER_USERNAME       <you>
       ORBIT_AI_DAILY_BUDGET_USD  1
       ORBIT_AI_MONTHLY_BUDGET_USD 20
       ORBIT_DRY_RUN              true   (flip to false when ready)
  5. Push to GitHub. The schedule runs every 30 min.
  6. Watch your first cycle: gh run watch
  7. Verify with: npx @orbithouse/sdk status

docs: https://orbit.horse  ·  https://github.com/orbithousezkp/orbit
```

Plain text. No colors unless TTY. No emoji.

## 6. Failure Modes

| Mode | Behavior |
|---|---|
| Node version < 18 | Exit 1 with `requires Node 18+, found vX.Y.Z` |
| Target dir not writable | Exit 1 with `cannot write to <path>: EACCES` |
| Partial install (mid-write fail) | Track written paths; on failure roll back; print `rolled back N files` |
| Target dir not empty (no --here) | Prompt `directory ./x is not empty. continue? [y/N]`. Default no |
| `package.json` malformed | Skip merge with warning, write companion `package.orbit.json.suggested` |
| Network down during `npm install` | Print warning, complete scaffold, instruct manual `npm install` |
| Workflow file in repo where Actions disabled | Detect via `.github/disabled` marker; write file but warn |
| `--force` passed and backup write fails | Abort that file's overwrite, keep original |
| Disk full mid-write | Roll back, exit 1 |
| `npx` cache stale | Print current version vs installed at start; suggest `npm exec --yes create-orbit-house@latest` |

## 7. Test Plan

- `__tests__/detect.test.js` — node version, dir existence, file-conflict matrix
- `__tests__/writer.test.js` — write/skip/force/backup with mock fs
- `__tests__/merge-package.test.js` — deep-merge preserves existing scripts/deps
- `__tests__/prompts.test.js` — argv → resolved options for all flag combos
- `__tests__/templates.test.js` — every template renders with valid JSON/YAML
- E2E: in fresh tmp dir, `node bin.js .`, then `git init`, then `npm run cycle --dry-run` (uses local SDK link) — assert a proof file gets written
- E2E in existing dir: copy `tests/fixtures/existing-repo` to tmp, run scaffolder, assert original files untouched and new files merged
- Snapshot test: produced files vs golden output in `__tests__/golden/`

CI matrix: Node 18, 20, 22 on ubuntu-latest and macos-latest.

## 8. npm Publish Steps

Run after D-009 prerequisites (npm `@orbithouse` org registered):

1. Bump version in `packages/create-orbit-house/package.json` to `0.1.0`
2. Verify `name` is `create-orbit-house` (UNSCOPED — so `npx create-orbit-house` works directly without org prefix)
3. Verify `bin.js` has `#!/usr/bin/env node`, executable bit set
4. `npm pack --dry-run` from packages/create-orbit-house, confirm files list contains: bin.js, src/, templates/, README.md, LICENSE, package.json — excludes node_modules, tests, .DS_Store
5. Add `files` field to package.json to whitelist
6. Add `.npmignore` if needed
7. Local smoke: `npm pack && cd /tmp && mkdir t && cd t && npx /path/to/create-orbit-house-0.1.0.tgz . --dry-run`
8. `npm login` (owner machine)
9. `npm publish --access public` (unscoped public; no auth scope conflict)
10. Verify: `npx create-orbit-house@0.1.0 --version` from clean shell
11. Tag commit: `git tag create-orbit-house-v0.1.0 && git push --tags`
12. Add row to STATUS.md showing publish hash + timestamp

For subsequent versions, gate publish behind a GitHub Action that runs full test suite first; manual `npm publish` only after green CI.
