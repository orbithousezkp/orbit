"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { assertSafePublicReply, redactSecrets } = require("./safety");
const { scanTextRisk } = require("./scam");

const NEYNAR_CAST_URL = "https://api.neynar.com/v2/farcaster/cast";
const CAST_BYTE_LIMIT = 320;
const LEDGER_PATH = "memory/farcaster-casts.json";
const MILESTONE_CYCLES = new Set([1, 10, 100, 1000, 10000]);
const URL_HOST_ALLOWLIST = ["orbit.horse", "github.com", "basescan.org"];
const EVM_ADDRESS_RE = /0x[a-fA-F0-9]{40}/g;
const SAFE_TOOL_PHRASES = {
  approve_spend: "approved spend",
  refuse_spend: "refused spend",
  update_state: "updated state",
  update_memory: "updated memory",
  update_roadmap: "updated roadmap",
  open_pull_request: "opened pull request",
  label_issue: "labeled issue",
  close_issue: "closed issue"
};

function pickTemplate(cycleSummary) {
  const summary = cycleSummary || {};
  if (summary.mistakeAcknowledgment) {
    return { kind: "mistake", data: summary };
  }
  if (summary.buybackTxHash) {
    return { kind: "buyback", data: summary };
  }
  if (MILESTONE_CYCLES.has(summary.cycle) || summary.notableStat) {
    return { kind: "milestone", data: summary };
  }
  if (summary.approvalIssueUrl) {
    return { kind: "approval-pending", data: summary };
  }
  if (summary.refusal && summary.refusal.oneLineSummary) {
    return { kind: "refusal", data: summary };
  }
  return { kind: "routine", data: summary };
}

function byteLen(text) {
  return Buffer.byteLength(String(text || ""), "utf8");
}

function truncateUtf8(text, limit) {
  const value = String(text || "");
  if (byteLen(value) <= limit) return value;
  const buf = Buffer.from(value, "utf8");
  let end = Math.min(buf.length, limit);
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1;
  return buf.slice(0, end).toString("utf8");
}

function renderRoutine(data, receiptUrl) {
  const triggerLabel = String(data.triggerLabel || "cycle");
  const aiUsd = String(data.aiUsdLabel || "$0.00");
  const refused = Number(data.refusedCount || 0);
  const pending = Number(data.pendingCount || 0);
  const bullets = Array.isArray(data.bullets) ? data.bullets.slice(0, 3) : [];

  const buildText = (list) => {
    const bulletBlock = list.length
      ? list.map((b) => `· ${b}`).join("\n") + "\n\n"
      : "";
    return `cycle #${data.cycle} · ${triggerLabel}\n\n${bulletBlock}${aiUsd} AI · ${refused} refused · ${pending} pending\n\nreceipt: ${receiptUrl}`;
  };

  let working = bullets.slice();
  let text = buildText(working);
  while (byteLen(text) > CAST_BYTE_LIMIT && working.length) {
    working.pop();
    text = buildText(working);
  }
  if (byteLen(text) > CAST_BYTE_LIMIT) {
    text = truncateUtf8(text, CAST_BYTE_LIMIT);
  }
  return text;
}

function renderMistake(data, receiptUrl) {
  const target = String(data.mistakeAcknowledgment || "the prior decision");
  const text = `cycle #${data.cycle} · correction\n\nearlier call on ${target} was wrong. reverted, logged.\n\nreceipt: ${receiptUrl}`;
  return byteLen(text) > CAST_BYTE_LIMIT ? truncateUtf8(text, CAST_BYTE_LIMIT) : text;
}

function renderBuyback(data, receiptUrl) {
  const weth = data.wethAmount || "0";
  const approval = data.approvalUrl || "";
  const orbit = data.orbitAmount || "0";
  const price = data.price || "0";
  const basescan = data.basescanUrl || "";
  const text = `treasury ${weth} WETH this week\napproved: ${approval}\nbought back: ${orbit} $ORBIT at $${price}\ntx: ${basescan}\n\nreceipt: ${receiptUrl}`;
  return byteLen(text) > CAST_BYTE_LIMIT ? truncateUtf8(text, CAST_BYTE_LIMIT) : text;
}

function renderMilestone(data, receiptUrl) {
  const stat = data.notableStat || `cycle #${data.cycle}`;
  const text = `cycle #${data.cycle}\n${stat}\n\nreceipt: ${receiptUrl}`;
  return byteLen(text) > CAST_BYTE_LIMIT ? truncateUtf8(text, CAST_BYTE_LIMIT) : text;
}

function renderApprovalPending(data, receiptUrl) {
  const purpose = String(data.approvalPurpose || "spend funds");
  const issue = String(data.approvalIssueUrl || "");
  const amount = String(data.amountLabel || "tbd");
  const text = `asking permission to ${purpose}\nissue: ${issue}\ncost: ${amount}\nwill wait\n\nreceipt: ${receiptUrl}`;
  return byteLen(text) > CAST_BYTE_LIMIT ? truncateUtf8(text, CAST_BYTE_LIMIT) : text;
}

function renderRefusal(data, receiptUrl) {
  const refusal = data.refusal || {};
  const oneLine = String(refusal.oneLineSummary || "unsafe request").toLowerCase();
  const category = String(refusal.category || "policy").toLowerCase();
  let text = `refused: ${oneLine}\nwhy: ${category}\nlogged: ${receiptUrl}`;
  if (byteLen(text) > CAST_BYTE_LIMIT) {
    const overflow = byteLen(text) - CAST_BYTE_LIMIT;
    const trimmed = truncateUtf8(oneLine, Math.max(1, byteLen(oneLine) - overflow - 3)) + "...";
    text = `refused: ${trimmed}\nwhy: ${category}\nlogged: ${receiptUrl}`;
  }
  if (byteLen(text) > CAST_BYTE_LIMIT) {
    text = truncateUtf8(text, CAST_BYTE_LIMIT);
  }
  return text;
}

function buildEmbeds(data) {
  const embeds = [];
  if (data.receiptUrl) embeds.push({ url: data.receiptUrl });
  if (data.fallbackReceiptUrl && data.fallbackReceiptUrl !== data.receiptUrl) {
    embeds.push({ url: data.fallbackReceiptUrl });
  }
  return embeds.filter((e) => isAllowedEmbedUrl(e.url)).slice(0, 2);
}

function isAllowedEmbedUrl(url) {
  if (typeof url !== "string" || url.length === 0 || url.length > 256) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return URL_HOST_ALLOWLIST.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch (_error) {
    return false;
  }
}

function renderCast(template, data, options = {}) {
  const tpl = template || { kind: "routine", data };
  const merged = Object.assign({}, tpl.data || data || {});
  const receiptUrl = options.receiptUrl || merged.receiptUrl || "";
  merged.receiptUrl = receiptUrl;
  let text;
  switch (tpl.kind) {
    case "mistake":
      text = renderMistake(merged, receiptUrl);
      break;
    case "buyback":
      text = renderBuyback(merged, receiptUrl);
      break;
    case "milestone":
      text = renderMilestone(merged, receiptUrl);
      break;
    case "approval-pending":
      text = renderApprovalPending(merged, receiptUrl);
      break;
    case "refusal":
      text = renderRefusal(merged, receiptUrl);
      break;
    case "routine":
    default:
      text = renderRoutine(merged, receiptUrl);
      break;
  }
  text = text.toLowerCase();
  if (byteLen(text) > CAST_BYTE_LIMIT) {
    text = truncateUtf8(text, CAST_BYTE_LIMIT);
  }
  const embeds = buildEmbeds(merged);
  return { text, embeds };
}

function scanOutbound(text, config = {}) {
  const value = String(text || "");
  let working = value;
  try {
    assertSafePublicReply(value);
  } catch (error) {
    return { safe: false, reason: "unsafe_public_reply", redacted: redactSecrets(value) };
  }

  const afterRedact = redactSecrets(value);
  if (afterRedact !== value) {
    return { safe: false, reason: "secret_pattern", redacted: afterRedact };
  }
  working = afterRedact;

  const risk = scanTextRisk(working);
  if (risk && risk.level === "critical") {
    return { safe: false, reason: "critical_risk", redacted: working };
  }

  if (byteLen(working) > CAST_BYTE_LIMIT) {
    return { safe: false, reason: "too_long", redacted: working };
  }

  const treasury = config && typeof config.treasuryAddress === "string"
    ? config.treasuryAddress.toLowerCase()
    : "";
  const matches = working.match(EVM_ADDRESS_RE) || [];
  for (const addr of matches) {
    if (addr.toLowerCase() !== treasury) {
      return { safe: false, reason: "evm_address", redacted: working };
    }
  }

  return { safe: true, redacted: working };
}

function castIdempotencyKey(cycle, finishedAt) {
  return crypto
    .createHash("sha256")
    .update(`orbit-cycle-cast:${cycle}:${finishedAt}`)
    .digest("hex")
    .slice(0, 32);
}

function truncateTitle(value, max = 60) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 3))}...`;
}

function bulletFromStep(step) {
  if (!step || typeof step !== "object") return null;
  const tool = step.tool || step.toolName;
  if (!tool) return null;
  const input = step.input && typeof step.input === "object" ? step.input : {};
  switch (tool) {
    case "comment_issue":
      if (typeof input.issueNumber === "number") {
        return `replied to issue #${input.issueNumber}`;
      }
      return "replied to an issue";
    case "append_memory":
    case "write_memory": {
      const title = truncateTitle(input.title || "knowledge");
      return `logged knowledge: ${title}`;
    }
    case "propose_spend":
      return "proposed spend, gated";
    case "create_issue":
      if (typeof input.issueNumber === "number") {
        return `opened issue #${input.issueNumber}`;
      }
      if (typeof input.title === "string") {
        return `opened issue: ${truncateTitle(input.title)}`;
      }
      return "opened an issue";
    default:
      if (Object.prototype.hasOwnProperty.call(SAFE_TOOL_PHRASES, tool)) {
        return SAFE_TOOL_PHRASES[tool];
      }
      return null;
  }
}

function deriveBullets(proof) {
  if (!proof || !Array.isArray(proof.steps)) return [];
  const bullets = [];
  for (const step of proof.steps) {
    if (bullets.length >= 3) break;
    const phrase = bulletFromStep(step);
    if (phrase) bullets.push(phrase);
  }
  return bullets;
}

function formatUsd(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "$0.00";
  if (value >= 100) return `$${value.toFixed(0)}`;
  return `$${value.toFixed(2)}`;
}

function sumAiUsd(proof) {
  if (!proof || !Array.isArray(proof.steps)) return 0;
  let total = 0;
  for (const step of proof.steps) {
    if (step && step.accounting === "ai_usage" && Number.isFinite(Number(step.estimatedUsd))) {
      total += Number(step.estimatedUsd);
    }
  }
  return total;
}

function countRefused(proof) {
  if (!proof || !Array.isArray(proof.steps)) return 0;
  let count = 0;
  for (const step of proof.steps) {
    if (!step) continue;
    if (step.refused === true) count += 1;
    else if (step.risk && step.risk.level === "high") count += 1;
  }
  return count;
}

function countPending(proof) {
  if (!proof || !Array.isArray(proof.steps)) return 0;
  let count = 0;
  for (const step of proof.steps) {
    if (step && (step.pending === true || step.approvalPending === true)) count += 1;
  }
  return count;
}

function triggerLabel(proof) {
  const trigger = proof && proof.trigger;
  if (!trigger || typeof trigger !== "object") return "cycle";
  const type = String(trigger.type || "").trim();
  const id = trigger.id != null ? String(trigger.id) : "";
  if (type === "issue" && id) return `issue #${id}`;
  if (type === "schedule") return "schedule";
  if (type && id) return `${type}:${id}`;
  return type || "cycle";
}

function findApprovalIssueUrl(proof) {
  if (!proof || !Array.isArray(proof.steps)) return null;
  for (const step of proof.steps) {
    if (!step) continue;
    if (step.approvalIssueUrl) return String(step.approvalIssueUrl);
    if (step.output && step.output.approvalIssueUrl) return String(step.output.approvalIssueUrl);
  }
  return null;
}

function findRefusal(proof) {
  if (!proof || !Array.isArray(proof.steps)) return null;
  for (const step of proof.steps) {
    if (!step) continue;
    if (step.refused && step.risk && step.risk.level) {
      return {
        oneLineSummary: String(step.refusalReason || step.reason || "unsafe action"),
        category: String(step.risk.category || step.risk.level)
      };
    }
  }
  return null;
}

function summarizeCycleForCast(proof, context = {}, config = {}) {
  const summaryProof = proof || {};
  const cycle = Number(summaryProof.cycle || 0);
  const finishedAt = String(summaryProof.finishedAt || "");
  const baseUrl = (config && config.publicBaseUrl) || "https://orbit.horse";
  const repoSlug = (config && config.repoSlug) || (context && context.repoSlug) || "";
  const proofRelative = (context && context.proofPath) || summaryProof.proofPath || "";
  const fallbackReceiptUrl = repoSlug && proofRelative
    ? `https://github.com/${repoSlug}/blob/main/${proofRelative}`
    : "";

  const refusal = findRefusal(summaryProof);
  const summary = {
    cycle,
    finishedAt,
    triggerLabel: triggerLabel(summaryProof),
    receiptUrl: `${baseUrl.replace(/\/$/, "")}/receipts/${cycle}`,
    fallbackReceiptUrl,
    bullets: deriveBullets(summaryProof),
    aiUsdLabel: formatUsd(sumAiUsd(summaryProof)),
    refusedCount: countRefused(summaryProof),
    pendingCount: countPending(summaryProof),
    approvalIssueUrl: findApprovalIssueUrl(summaryProof),
    mistakeAcknowledgment: summaryProof.mistake
      ? String(summaryProof.mistake.targetRef || summaryProof.mistake.target || "earlier decision")
      : null,
    buybackTxHash: summaryProof.buyback ? String(summaryProof.buyback.txHash || "") : null,
    notableStat: context && context.notableStat ? String(context.notableStat) : null,
    refusal
  };
  return summary;
}

function recordCastReceipt(proof, castResult) {
  if (!proof || typeof proof !== "object") return;
  proof.cast = castResult || null;
}

function ledgerAbsPath(repoRoot) {
  return path.join(repoRoot, LEDGER_PATH);
}

function loadCastLedger(repoRoot) {
  if (!repoRoot) return { casts: [] };
  const full = ledgerAbsPath(repoRoot);
  try {
    const raw = fs.readFileSync(full, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.casts)) {
      return { casts: [] };
    }
    return { casts: parsed.casts };
  } catch (_error) {
    return { casts: [] };
  }
}

function saveCastLedger(repoRoot, ledger) {
  if (!repoRoot) return LEDGER_PATH;
  const full = ledgerAbsPath(repoRoot);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const payload = `${JSON.stringify(
    { casts: Array.isArray(ledger && ledger.casts) ? ledger.casts : [] },
    null,
    2
  )}\n`;
  fs.writeFileSync(full, payload, "utf8");
  return LEDGER_PATH;
}

function farcasterConfig(config) {
  const fc = (config && config.farcaster) || {};
  return {
    dryRun: Boolean(fc.dryRun),
    apiKey: fc.apiKey ? String(fc.apiKey) : "",
    signerUuid: fc.signerUuid ? String(fc.signerUuid) : ""
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOnce(fc, payload) {
  const body = JSON.stringify({
    signer_uuid: fc.signerUuid,
    text: payload.text,
    embeds: payload.embeds || [],
    idem: payload.idem
  });
  const response = await fetch(NEYNAR_CAST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": fc.apiKey,
      Accept: "application/json"
    },
    body,
    signal: AbortSignal.timeout(10_000)
  });
  const status = response.status;
  let parsed = null;
  try {
    parsed = await response.json();
  } catch (_error) {
    parsed = null;
  }
  return { status, parsed, ok: response.ok };
}

async function publishCast(config, payload) {
  const fc = farcasterConfig(config);
  if (fc.dryRun) {
    return { ok: true, dryRun: true, hash: null, status: 0 };
  }
  if (!fc.apiKey || !fc.signerUuid) {
    return { ok: false, error: "not_configured" };
  }
  if (!payload || typeof payload.text !== "string" || payload.text.length === 0) {
    return { ok: false, error: "empty_payload" };
  }

  let attempt = 0;
  let lastError = null;
  while (attempt < 2) {
    attempt += 1;
    try {
      const { status, parsed, ok } = await postOnce(fc, payload);
      if (status === 429) {
        return { ok: false, error: "rate_limit", status: 429 };
      }
      if (status === 401 || status === 403) {
        return { ok: false, error: "signer_invalid", status };
      }
      if (ok) {
        const hash = parsed && parsed.cast && parsed.cast.hash
          ? String(parsed.cast.hash)
          : (parsed && parsed.hash ? String(parsed.hash) : null);
        return { ok: true, hash, status };
      }
      if (status >= 500 && attempt < 2) {
        await sleep(1500);
        continue;
      }
      return {
        ok: false,
        error: status >= 500 ? "neynar_unreachable" : "neynar_error",
        status
      };
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await sleep(1500);
        continue;
      }
    }
  }
  return {
    ok: false,
    error: "neynar_unreachable",
    detail: lastError ? redactSecrets(String(lastError.message || lastError)) : ""
  };
}

async function postCycleCast(config, cycleSummary, proof) {
  const safeSummary = cycleSummary || {};
  const idem = castIdempotencyKey(safeSummary.cycle, safeSummary.finishedAt);
  const repoRoot = (config && config.repoRoot) || "";
  const ledger = loadCastLedger(repoRoot);

  const existing = ledger.casts.find(
    (entry) =>
      entry &&
      entry.cycle === safeSummary.cycle &&
      entry.idem === idem &&
      entry.dryRun !== true &&
      entry.hash
  );
  if (existing) {
    return {
      ok: true,
      idempotent: true,
      hash: existing.hash,
      kind: existing.kind,
      idem
    };
  }

  const template = pickTemplate(safeSummary);
  const rendered = renderCast(template, template.data, {
    receiptUrl: safeSummary.receiptUrl
  });
  const scan = scanOutbound(rendered.text, config);
  if (!scan.safe) {
    return {
      ok: false,
      blocked: true,
      reason: scan.reason,
      kind: template.kind,
      idem
    };
  }

  const result = await publishCast(config, {
    text: rendered.text,
    embeds: rendered.embeds,
    idem
  });

  let ledgerPath = LEDGER_PATH;
  if (result.ok) {
    ledger.casts.push({
      cycle: safeSummary.cycle,
      idem,
      hash: result.hash || null,
      castedAt: new Date().toISOString(),
      kind: template.kind,
      dryRun: result.dryRun === true
    });
    try {
      ledgerPath = saveCastLedger(repoRoot, ledger);
    } catch (_error) {
      ledgerPath = LEDGER_PATH;
    }
  }

  return {
    ok: result.ok === true,
    kind: template.kind,
    hash: result.hash || null,
    dryRun: result.dryRun === true,
    idem,
    ledgerPath,
    error: result.error,
    blocked: false,
    status: result.status
  };
}

module.exports = {
  NEYNAR_CAST_URL,
  CAST_BYTE_LIMIT,
  LEDGER_PATH,
  pickTemplate,
  renderCast,
  scanOutbound,
  castIdempotencyKey,
  summarizeCycleForCast,
  recordCastReceipt,
  loadCastLedger,
  saveCastLedger,
  publishCast,
  postCycleCast
};
