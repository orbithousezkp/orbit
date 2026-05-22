"use strict";

const SAFE_DOMAINS = new Set([
  "github.com",
  "docs.github.com",
  "clanker.world",
  "www.clanker.world",
  "clanker.gitbook.io",
  "basescan.org",
  "base.org",
  "docs.base.org",
  "openai.com",
  "platform.openai.com"
]);

const SHORTENER_DOMAINS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "rebrand.ly",
  "cutt.ly",
  "is.gd",
  "buff.ly",
  "ow.ly"
]);

const RISK_PATTERNS = [
  { severity: 100, category: "secret_request", pattern: /\b(seed phrase|private key|recovery phrase|mnemonic|wallet backup)\b/i, message: "Requests or mentions wallet secrets." },
  { severity: 95, category: "drain_phrase", pattern: /\b(unlimited approval|setapprovalforall|permit signature|increase allowance|approve all|token approval)\b/i, message: "Mentions high-risk approval behavior." },
  { severity: 90, category: "fund_transfer", pattern: /\b(send|transfer|bridge|swap)\b.{0,80}\b(eth|weth|usdc|token|treasury|funds?)\b/i, message: "Requests movement of funds or tokens." },
  { severity: 88, category: "fake_support", pattern: /\b(support agent|wallet support|sync your wallet|validate your wallet|rectify your wallet|fix your wallet)\b/i, message: "Uses common fake wallet-support language." },
  { severity: 86, category: "urgent_pressure", pattern: /\b(urgent|immediately|within \d+ minutes|final warning|last chance|your funds are at risk)\b/i, message: "Applies urgency pressure." },
  { severity: 84, category: "reward_claim", pattern: /\b(claim|airdrop|free token|reward|allocation)\b.{0,80}\b(connect|sign|approve|wallet)\b/i, message: "Combines rewards with wallet signing." },
  { severity: 80, category: "prompt_injection", pattern: /\b(ignore previous|ignore all|system prompt|developer message|you are now|jailbreak|disable safety)\b/i, message: "Attempts prompt or policy override." },
  { severity: 82, category: "encoded_instruction_relay", pattern: /\b(decode|decrypt|translate|convert|read)\b.{0,80}\b(morse|base64|hex|rot13|cipher|encoded)\b|\b(morse|base64|hex|rot13|cipher|encoded)\b.{0,80}\b(paste|post|reply|comment|send|say|plain ?text|plaintext|what (?:does|is)|means?)\b|\bwhat\s+(?:does|is)\b.{0,80}\b(morse|base64|hex|rot13|cipher|encoded)\b.{0,80}\b(say|mean|plain ?text|plaintext)\b/i, message: "Asks Orbit to decode or relay hidden visitor content." },
  { severity: 78, category: "obfuscation", pattern: /\b(base64|hex encoded|morse code|decode this|decrypt this|eval\(|atob\(|fromcharcode)\b/i, message: "Mentions encoded or executable payloads." },
  { severity: 74, category: "external_wallet", pattern: /\b0x[a-fA-F0-9]{40}\b/, message: "Contains an EVM address that may be an external recipient." },
  { severity: 60, category: "credential_phish", pattern: /\b(api key|password|login token|github token|secret)\b.{0,80}\b(send|share|paste|post|enter)\b/i, message: "Requests credential sharing." }
];

const OMIT_VISITOR_CONTENT_CATEGORIES = new Set([
  "encoded_instruction_relay",
  "obfuscation"
]);

const OMITTED_VISITOR_CONTENT = "[OMITTED: encoded or obfuscated visitor content requires human review]";

function extractUrls(text) {
  return Array.from(String(text || "").matchAll(/\bhttps?:\/\/[^\s<>"')]+/gi)).map((match) => match[0]);
}

function domainOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function scanUrl(url) {
  const domain = domainOf(url);
  const flags = [];

  if (!domain) {
    flags.push({ severity: 50, category: "malformed_url", message: "URL could not be parsed.", url });
  } else if (SHORTENER_DOMAINS.has(domain)) {
    flags.push({ severity: 80, category: "shortened_url", message: "Shortened links hide the final destination.", url, domain });
  } else if (!SAFE_DOMAINS.has(domain) && /wallet|claim|airdrop|reward|token|swap|bridge|approve/i.test(url)) {
    flags.push({ severity: 70, category: "unknown_financial_domain", message: "Unknown financial or wallet-related domain.", url, domain });
  }

  if (/[^\x20-\x7e]/.test(url)) {
    flags.push({ severity: 65, category: "unicode_url", message: "URL contains non-ASCII characters.", url, domain });
  }

  return flags;
}

function riskLevel(score) {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score > 0) return "low";
  return "clear";
}

function scanTextRisk(text) {
  const value = String(text || "");
  const flags = [];

  for (const rule of RISK_PATTERNS) {
    if (rule.pattern.test(value)) {
      flags.push({
        severity: rule.severity,
        category: rule.category,
        message: rule.message
      });
    }
  }

  for (const url of extractUrls(value)) {
    flags.push(...scanUrl(url));
  }

  const score = flags.reduce((max, flag) => Math.max(max, flag.severity), 0);
  return {
    safe: score < 70,
    level: riskLevel(score),
    score,
    flags
  };
}

function shouldOmitVisitorContent(risk) {
  return Boolean(
    risk &&
    Array.isArray(risk.flags) &&
    risk.flags.some((flag) => OMIT_VISITOR_CONTENT_CATEGORIES.has(flag.category))
  );
}

function omitUnsafeVisitorContent(text, risk = scanTextRisk(text)) {
  return shouldOmitVisitorContent(risk) ? OMITTED_VISITOR_CONTENT : text;
}

function scanSpendIntent(intent = {}) {
  const text = [
    intent.purpose,
    intent.reason,
    intent.recipient,
    intent.asset,
    intent.category,
    intent.url,
    intent.notes
  ].filter(Boolean).join("\n");

  const risk = scanTextRisk(text);
  if (intent.recipient && /^0x[a-fA-F0-9]{40}$/.test(String(intent.recipient)) && intent.recipient !== intent.treasuryAddress && intent.recipient !== intent.operatorRevenueAddress) {
    risk.flags.push({
      severity: 76,
      category: "external_recipient",
      message: "Spend intent targets an address outside Orbit's configured self/revenue recipients."
    });
    risk.score = Math.max(risk.score, 76);
    risk.level = riskLevel(risk.score);
    risk.safe = risk.score < 70;
  }

  return risk;
}

module.exports = {
  OMITTED_VISITOR_CONTENT,
  SAFE_DOMAINS,
  extractUrls,
  omitUnsafeVisitorContent,
  scanSpendIntent,
  scanTextRisk,
  scanUrl,
  shouldOmitVisitorContent
};
