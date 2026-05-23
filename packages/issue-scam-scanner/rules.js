"use strict";

/**
 * Risk patterns for scanning issue/PR/comment text.
 * Each rule has: severity (0-100), category, regex, and a human-readable message.
 * Derived from Orbit's household scam scanner (src/agent/scam.js).
 */

const RISK_PATTERNS = [
  {
    severity: 100,
    category: "secret_request",
    pattern: /\b(seed phrase|private key|recovery phrase|mnemonic|wallet backup)\b/i,
    message: "Requests or mentions wallet secrets."
  },
  {
    severity: 95,
    category: "drain_phrase",
    pattern: /\b(unlimited approval|setapprovalforall|permit signature|increase allowance|approve all|token approval)\b/i,
    message: "Mentions high-risk approval behavior."
  },
  {
    severity: 90,
    category: "fund_transfer",
    pattern: /\b(send|transfer|bridge|swap)\b.{0,80}\b(eth|weth|usdc|token|treasury|funds?)\b/i,
    message: "Requests movement of funds or tokens."
  },
  {
    severity: 88,
    category: "fake_support",
    pattern: /\b(support agent|wallet support|sync your wallet|validate your wallet|rectify your wallet|fix your wallet)\b/i,
    message: "Uses common fake wallet-support language."
  },
  {
    severity: 86,
    category: "urgent_pressure",
    pattern: /\b(urgent|immediately|within \d+ minutes|final warning|last chance|your funds are at risk)\b/i,
    message: "Applies urgency pressure."
  },
  {
    severity: 84,
    category: "reward_claim",
    pattern: /\b(claim|airdrop|free token|reward|allocation)\b.{0,80}\b(connect|sign|approve|wallet)\b/i,
    message: "Combines rewards with wallet signing."
  },
  {
    severity: 80,
    category: "prompt_injection",
    pattern: /\b(ignore previous|ignore all|system prompt|developer message|you are now|jailbreak|disable safety)\b/i,
    message: "Attempts prompt or policy override."
  },
  {
    severity: 82,
    category: "encoded_instruction_relay",
    pattern: /\b(decode|decrypt|translate|convert|read)\b.{0,80}\b(morse|base64|hex|rot13|cipher|encoded)\b|\b(morse|base64|hex|rot13|cipher|encoded)\b.{0,80}\b(paste|post|reply|comment|send|say|plain ?text|plaintext|what (?:does|is)|means?)\b|\bwhat\s+(?:does|is)\b.{0,80}\b(morse|base64|hex|rot13|cipher|encoded)\b.{0,80}\b(say|mean|plain ?text|plaintext)\b/i,
    message: "Asks to decode or relay hidden visitor content."
  },
  {
    severity: 78,
    category: "obfuscation",
    pattern: /\b(base64|hex encoded|morse code|decode this|decrypt this|eval\(|atob\(|fromcharcode)\b/i,
    message: "Mentions encoded or executable payloads."
  },
  {
    severity: 74,
    category: "external_wallet",
    pattern: /\b0x[a-fA-F0-9]{40}\b/,
    message: "Contains an EVM address that may be an external recipient."
  },
  {
    severity: 75,
    category: "credential_phish",
    pattern: /\b(?:api key|password|login token|github token|secret)\b.{0,80}\b(?:send|share|paste|post|enter)\b|\b(?:send|share|paste|post|enter)\b.{0,80}\b(?:api key|password|login token|github token|secret)\b/i,
    message: "Requests credential sharing."
  }
];

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

const SAFE_DOMAINS = new Set([
  "github.com",
  "docs.github.com",
  "gitlab.com",
  "stackoverflow.com",
  "developer.mozilla.org",
  "npmjs.com"
]);

/**
 * Default allow patterns — suppress flags when text matches known-safe contexts.
 * Each entry has:
 *   - pattern: RegExp to match against the full input text
 *   - categories: array of flag categories to suppress, or ["all"] for all
 *   - message: human-readable explanation of why this context is safe
 *
 * These reduce false positives when scanning educational content, policy docs,
 * security documentation, scanner development text, and safety checklists.
 */
const ALLOW_PATTERNS = [
  {
    categories: ["all"],
    pattern: /\b(never reveal|never send|never share|do not reveal|do not send|do not share|must not reveal|must not send|must not share|hard rules?|safety (?:rules?|invariant|policy))\b/i,
    message: "Safety policy language — content establishes protective rules, not attacks."
  },
  {
    categories: ["all"],
    pattern: /\b(what (?:it does not|is not|does NOT) include|no (?:signing|access to|smart contract|private keys?|deployment))\b/i,
    message: "Scope exclusion language — content defines boundaries and prohibitions."
  },
  {
    categories: ["secret_request", "credential_phish"],
    pattern: /\b(security (?:review|audit|check|scan)|threat (?:model|scan|detection)|scam (?:scan|detection|pattern|flag)|detect(?:s|ion)? (?:prompt|wallet|seed|scam))\b/i,
    message: "Security review context — mentions secrets in a detection or audit capacity."
  },
  {
    categories: ["prompt_injection", "obfuscation"],
    pattern: /\b(this scanner|the scanner|scanning engine|risk (?:patterns?|rules?|flags?)|threat categories|false positive|false negative)\b/i,
    message: "Scanner development context — discusses detection patterns, not attacks."
  },
  {
    categories: ["all"],
    pattern: /\b(no outreach|no (?:payment|commitment|spend|signing|wallet action|treasury transfer|external commitment))\b/i,
    message: "Boundary language — content explicitly states what will not happen."
  }
];

module.exports = { RISK_PATTERNS, SHORTENER_DOMAINS, SAFE_DOMAINS, ALLOW_PATTERNS };
