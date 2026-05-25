"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  sanitizeCycleNoteForPublic,
  noteContainsMoney,
  isCycleNotePath,
  aiBudgetLevel,
  redactBudgetForAi
} = require("../src/agent/cycle-note-sanitize");

test("sanitizeCycleNoteForPublic strips ### AI food section", () => {
  const input = [
    "# Cycle 56",
    "",
    "Some intro.",
    "",
    "### AI food",
    "",
    "- Lifetime: ~$3.16",
    "- Daily remaining: ~$4.59",
    "",
    "### Next",
    "",
    "Continue work."
  ].join("\n");
  const out = sanitizeCycleNoteForPublic(input);
  assert.equal(out.includes("AI food"), false);
  assert.equal(out.includes("$3.16"), false);
  assert.equal(out.includes("$4.59"), false);
  assert.equal(out.includes("### Next"), true);
  assert.equal(out.includes("Continue work"), true);
});

test("sanitizeCycleNoteForPublic strips ## AI Costs and Inference costs variants", () => {
  for (const heading of ["## AI Costs", "### AI Budget", "#### Inference costs", "### Daily spend"]) {
    const input = `# Cycle\n\nIntro.\n\n${heading}\n\n- ~$1.00\n\n### Tail\nTail content.\n`;
    const out = sanitizeCycleNoteForPublic(input);
    assert.equal(out.includes(heading), false, `heading "${heading}" not stripped`);
    assert.equal(out.includes("$1.00"), false, `dollar after "${heading}" not stripped`);
    assert.equal(out.includes("Tail content"), true);
  }
});

test("sanitizeCycleNoteForPublic strips Lifetime: / Daily remaining: lines outside any heading", () => {
  const input = [
    "# Cycle",
    "",
    "Lifetime: ~$5.00",
    "Daily remaining: $2.00",
    "Monthly remaining: $80.00",
    "",
    "Normal content stays."
  ].join("\n");
  const out = sanitizeCycleNoteForPublic(input);
  assert.equal(out.includes("Lifetime"), false);
  assert.equal(out.includes("Daily remaining"), false);
  assert.equal(out.includes("Monthly remaining"), false);
  assert.equal(out.includes("Normal content stays."), true);
});

test("sanitizeCycleNoteForPublic strips Estimated cost / Tokens used / Total spend lines", () => {
  const input = [
    "Some intro",
    "Estimated cost: $2.50",
    "Tokens used: 12000",
    "Total spend: $100",
    "Other content."
  ].join("\n");
  const out = sanitizeCycleNoteForPublic(input);
  assert.equal(out.includes("Estimated cost"), false);
  assert.equal(out.includes("Tokens used"), false);
  assert.equal(out.includes("Total spend"), false);
  assert.equal(out.includes("Other content."), true);
});

test("sanitizeCycleNoteForPublic strips trailing dollar parens like (~$0.05)", () => {
  const input = "Wrote update to memory/state.json (~$0.05) and committed.";
  const out = sanitizeCycleNoteForPublic(input);
  assert.equal(out.includes("$0.05"), false);
  assert.match(out, /memory\/state\.json/);
  assert.match(out, /committed\./);
});

test("sanitizeCycleNoteForPublic is idempotent (re-running yields the same output)", () => {
  const input = "### AI food\n- $1\n### Next\nKeep.\n";
  const once = sanitizeCycleNoteForPublic(input);
  const twice = sanitizeCycleNoteForPublic(once);
  assert.equal(once, twice);
});

test("sanitizeCycleNoteForPublic preserves notes that contain no money references", () => {
  const input = "# Cycle 1\n\nNothing financial here.\n\n### Next\n\nKeep going.\n";
  const out = sanitizeCycleNoteForPublic(input);
  assert.equal(out, input);
});

test("sanitizeCycleNoteForPublic handles empty / non-string input gracefully", () => {
  assert.equal(sanitizeCycleNoteForPublic(""), "");
  assert.equal(sanitizeCycleNoteForPublic(null), null);
  assert.equal(sanitizeCycleNoteForPublic(undefined), undefined);
});

test("noteContainsMoney detects AI food section and money lines", () => {
  assert.equal(noteContainsMoney("### AI food\n- $1"), true);
  assert.equal(noteContainsMoney("Lifetime: ~$3.16"), true);
  assert.equal(noteContainsMoney("Estimated cost: $0.01"), true);
  assert.equal(noteContainsMoney("Just normal content."), false);
});

test("sanitizeCycleNoteForPublic strips bullet-form lines like '- AI food: ~$0.067'", () => {
  const input = [
    "# Cycle",
    "",
    "- AI food: ~$0.067 spent today, ~$4.93 daily remaining",
    "- AI food: ~$0.115 lifetime",
    "- Other bullet that stays",
    "1. **Checked AI food budget** — plenty of headroom",
    "Normal prose."
  ].join("\n");
  const out = sanitizeCycleNoteForPublic(input);
  assert.equal(out.includes("AI food"), false, "all AI food bullets/mentions must be stripped");
  assert.equal(out.includes("$0.067"), false);
  assert.equal(out.includes("$4.93"), false);
  assert.equal(out.includes("Other bullet that stays"), true);
  assert.equal(out.includes("Normal prose."), true);
});

test("sanitizeCycleNoteForPublic strips bold-prefix '**AI food:** Healthy' lines", () => {
  const input = "**AI food:** Healthy — ~$4.98/day, ~$99.98/month remaining\nKeep this line.";
  const out = sanitizeCycleNoteForPublic(input);
  assert.equal(out.includes("AI food"), false);
  assert.equal(out.includes("$4.98"), false);
  assert.equal(out.includes("Keep this line."), true);
});

test("isCycleNotePath matches memory/cycles/*.md only", () => {
  assert.equal(isCycleNotePath("memory/cycles/0001-test.md"), true);
  assert.equal(isCycleNotePath("memory/cycles/0099-something.md"), true);
  assert.equal(isCycleNotePath("memory/state.json"), false);
  assert.equal(isCycleNotePath("memory/cycles/subdir/file.md"), false);
  assert.equal(isCycleNotePath("memory/cycles.jsonl"), false);
  assert.equal(isCycleNotePath(null), false);
});

test("aiBudgetLevel maps full budgetStatus shape to enum", () => {
  assert.equal(aiBudgetLevel({ canUseAi: false }), "exhausted");
  assert.equal(aiBudgetLevel({ canUseAi: true, dailyRemainingUsd: 0.5, monthlyRemainingUsd: 80 }), "critical");
  assert.equal(aiBudgetLevel({ canUseAi: true, dailyRemainingUsd: 2, monthlyRemainingUsd: 80 }), "low");
  assert.equal(aiBudgetLevel({ canUseAi: true, dailyRemainingUsd: 4, monthlyRemainingUsd: 80 }), "ok");
  assert.equal(aiBudgetLevel(null), "unknown");
  assert.equal(aiBudgetLevel({}), "unknown");
});

test("redactBudgetForAi exposes only level + canUseAi, no dollar fields", () => {
  const full = {
    dailyBudgetUsd: 5,
    monthlyBudgetUsd: 100,
    dailyRemainingUsd: 4.59,
    monthlyRemainingUsd: 80,
    canUseAi: true,
    ledger: [{ estimatedUsd: 0.003 }]
  };
  const redacted = redactBudgetForAi(full);
  const keys = Object.keys(redacted).sort();
  assert.deepEqual(keys, ["canUseAi", "level"]);
  assert.equal(redacted.canUseAi, true);
  assert.equal(redacted.level, "ok");
});
