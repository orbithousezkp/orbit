"use strict";

function render(result, opts) {
  const lines = [];
  const where = result.targetDir;
  lines.push(`orbit scaffold complete in ${where}`);
  lines.push("");

  if (result.added.length > 0) {
    lines.push("added:");
    for (const p of result.added) lines.push(`  ${p}`);
    lines.push("");
  }

  if (result.merged.length > 0) {
    lines.push("merged:");
    for (const m of result.merged) {
      const detail = m.addedKeys && m.addedKeys.length ? ` (added: ${m.addedKeys.join(", ")})` : "";
      lines.push(`  ${m.path}${detail}`);
    }
    lines.push("");
  }

  if (result.skipped.length > 0) {
    lines.push("skipped (already present):");
    for (const s of result.skipped) {
      const reason = s.reason ? `  (${s.reason})` : "";
      lines.push(`  ${s.path}${reason}`);
    }
    lines.push("");
  }

  if (result.noop.length > 0) {
    lines.push("unchanged:");
    for (const p of result.noop) lines.push(`  ${p}`);
    lines.push("");
  }

  if (result.warnings.length > 0) {
    lines.push("warnings:");
    for (const w of result.warnings) lines.push(`  ${w}`);
    lines.push("");
  }

  lines.push("next steps:");
  lines.push(`  1. cd ${where}`);
  if (result.install) {
    lines.push("  2. npm install");
  } else {
    lines.push("  2. npm install            (skipped: --no-install was set)");
  }
  lines.push("  3. Set required GitHub secrets:");
  lines.push("       ORBIT_AI_PROVIDERS         JSON route list for AI provider");
  lines.push("       ORBIT_AI_PROVIDER_KEYS     AI provider API keys");
  lines.push("       ORBIT_WALLET_PRIVATE_KEY   Agent signing key");
  lines.push("       ORBIT_BASE_RPC_URL         Base RPC endpoint (optional, Phase 2)");
  lines.push("  4. Set GitHub variables:");
  lines.push(`       ORBIT_OWNER_USERNAME       ${opts.owner || "<you>"}`);
  lines.push("       ORBIT_AI_DAILY_BUDGET_USD  1");
  lines.push("       ORBIT_AI_MONTHLY_BUDGET_USD 20");
  lines.push("       ORBIT_DRY_RUN              true   (flip to false when ready)");
  lines.push("  5. Push to GitHub. The schedule runs every 30 min.");
  lines.push("  6. Watch your first cycle: gh run watch");
  lines.push("  7. Verify with: npx @orbit-house/sdk status");
  lines.push("");
  lines.push("docs: https://github.com/orbithousezkp/orbit");
  lines.push("");
  return lines.join("\n");
}

module.exports = { render };
