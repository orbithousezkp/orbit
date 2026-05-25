"use strict";

// Cycle-note + AI-budget sanitizer.
//
// Per feedback_no_money_on_github: strip specific "our-money" figures from
// any public surface. Cycle notes (memory/cycles/*.md) are GitHub-visible
// and the agent has been writing "AI food" sections + dollar figures into
// them. This module:
//
// 1. Strips "AI food" / "AI cost" sections from cycle-note markdown before
//    the note is committed.
// 2. Strips inline lines like "Lifetime: ~$X.XX" / "Daily remaining: $X.XX".
// 3. Redacts the dollar figures in `context.aiBudget` so the AI doesn't see
//    them in its prompt — agent decisions consume a binary level enum
//    instead. Treasury / cost-bearing CODE still uses the full numbers; the
//    redaction is purely for what gets fed into the LLM.
//
// Both passes are belt-and-braces: the prompt is told not to write money
// figures, and any leak gets stripped post-hoc.

const AI_BUDGET_HEADING = /^#{1,6}\s*(?:AI\s+food|AI\s+costs?|AI\s+budget|Inference\s+costs?|Daily\s+spend)\s*$/im;
const NEXT_HEADING = /^#{1,6}\s/;
// Lines whose meaningful content is an AI-cost line item (handles plain,
// bullet, numbered, and bold-prefix variants).
const MONEY_LINE = /^\s*(?:[-*•]|\d+\.|>)?\s*(?:\*\*)?\s*(Lifetime|Daily\s+remaining|Monthly\s+remaining|Spent\s+today|Estimated\s+cost|AI\s+cost|AI\s+food|Inference\s+cost|Cost\s+estimate|Tokens?\s+used|Total\s+spend|Budget\s+used)(?:\*\*)?\s*[:：]\s*.*$/i;
// Catch-all: any line that mentions "AI food" anywhere (prose, bullet, bold,
// inline). The user directive is "no AI usage visible at all" — broader than
// just structured cost lines.
const AI_FOOD_MENTION = /\bAI\s+food\b/i;
const TRAILING_DOLLAR = /\s*\(\s*~?\s*[\$€£]\s*\d+(?:[.,]\d+)?\s*\)\s*/g;

function stripAiBudgetSection(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (AI_BUDGET_HEADING.test(lines[i])) {
      // Drop the heading and every line until the next heading at any level
      // or end of file. Also drop a trailing blank line we leave behind.
      i += 1;
      while (i < lines.length && !NEXT_HEADING.test(lines[i])) i += 1;
      // Remove a trailing empty line above to avoid double-blank.
      while (out.length && out[out.length - 1] === "") out.pop();
      if (out.length) out.push("");
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  return out;
}

function stripMoneyLines(lines) {
  return lines.filter((line) => !MONEY_LINE.test(line) && !AI_FOOD_MENTION.test(line));
}

function stripTrailingDollarParens(text) {
  return text.replace(TRAILING_DOLLAR, " ");
}

function sanitizeCycleNoteForPublic(markdown) {
  if (typeof markdown !== "string" || !markdown) return markdown;
  const lines = markdown.split(/\r?\n/);
  const afterSections = stripAiBudgetSection(lines);
  const afterLines = stripMoneyLines(afterSections);
  let joined = afterLines.join("\n");
  joined = stripTrailingDollarParens(joined);
  // Collapse runs of 3+ blank lines down to 2.
  joined = joined.replace(/\n{3,}/g, "\n\n");
  return joined;
}

function noteContainsMoney(markdown) {
  if (typeof markdown !== "string" || !markdown) return false;
  if (AI_BUDGET_HEADING.test(markdown)) return true;
  if (MONEY_LINE.test(markdown)) return true;
  if (AI_FOOD_MENTION.test(markdown)) return true;
  return false;
}

function isCycleNotePath(relativePath) {
  return typeof relativePath === "string" && /^memory\/cycles\/[^/]+\.md$/i.test(relativePath);
}

// Compute the AI-budget level enum from a treasury budgetStatus() return.
// This is what the AI sees in its context.aiBudget — never the raw dollars.
function aiBudgetLevel(budget) {
  if (!budget || typeof budget !== "object") return "unknown";
  if (budget.canUseAi === false) return "exhausted";
  const daily = Number(budget.dailyRemainingUsd);
  const monthly = Number(budget.monthlyRemainingUsd);
  if (!Number.isFinite(daily) || !Number.isFinite(monthly)) return "unknown";
  if (daily <= 1 || monthly <= 5) return "critical";
  if (daily <= 2.5 || monthly <= 25) return "low";
  return "ok";
}

// Public projection of budgetStatus for AI consumption. No dollars.
function redactBudgetForAi(budget) {
  if (!budget || typeof budget !== "object") return { level: "unknown", canUseAi: false };
  return {
    level: aiBudgetLevel(budget),
    canUseAi: budget.canUseAi !== false
  };
}

module.exports = {
  sanitizeCycleNoteForPublic,
  noteContainsMoney,
  isCycleNotePath,
  aiBudgetLevel,
  redactBudgetForAi
};
