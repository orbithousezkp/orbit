# Publishing the Orbit packages

Two npm packages live in this repo:

| Package | Path | Purpose |
| --- | --- | --- |
| `@orbit-house/sdk` | `packages/orbit-sdk/` | Read-only SDK for any consumer of an Orbit repo (CLIs, dashboards, federation peers). |
| `create-orbit-house` | `packages/create-orbit-house/` | `npm init orbit-house <name>` scaffolder for new adopters. |

Both are public on npm with provenance, published by `.github/workflows/publish-packages.yml` on tag push.

## One-time owner setup

1. Generate an npm **automation token** (Account → Access Tokens → "Generate New Token" → Automation). Don't use a publish-only or classic token — provenance requires automation.
2. Add it to the repo as a secret:
   ```bash
   gh secret set NPM_TOKEN --body "npm_..."
   ```
3. (Optional) `gh secret set NPM_TOKEN --org orbithousezkp --visibility selected` if you'd rather scope it to the org.

## Cutting a release

The tag name determines which package ships. Bump the version in the package.json **first**, then tag.

```bash
# SDK
$EDITOR packages/orbit-sdk/package.json   # bump "version"
git commit -am "chore(sdk): v0.2.0"
git tag sdk-v0.2.0
git push origin main sdk-v0.2.0

# Scaffolder
$EDITOR packages/create-orbit-house/package.json
git commit -am "chore(scaffolder): v0.2.0"
git tag create-orbit-house-v0.2.0
git push origin main create-orbit-house-v0.2.0
```

The workflow:

1. Checks out the tagged commit.
2. Runs the full test suite — a failing test aborts the publish.
3. `npm pack --dry-run` sanity check on the target package.
4. `npm publish --provenance --access public`.

If you need to publish without a tag (e.g. emergency dot release), use the **workflow_dispatch** trigger from the Actions tab and pick `sdk` or `create-orbit-house`.

## What `npm publish` sees

Only the files listed in each package's `files` array end up in the tarball:

- `@orbit-house/sdk`: `index.js`, `cli.js`, `README.md`, `LICENSE` (≈12KB).
- `create-orbit-house`: `bin.js`, `src/`, `templates/`, `README.md`, `LICENSE` (≈12KB).

To verify before publishing:

```bash
cd packages/orbit-sdk && npm pack --dry-run
cd packages/create-orbit-house && npm pack --dry-run
```

## Versioning

SemVer. While in `0.x.y`, treat **minor** bumps as potentially breaking — adopters pin to a specific minor. Once we cut `1.0`, breaking changes require a major bump and a deprecation note in the next CYCLE_NOTE.
