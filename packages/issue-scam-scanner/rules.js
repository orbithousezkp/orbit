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

module.exports = { RISK_PATTERNS, SHORTENER_DOMAINS, SAFE_DOMAINS };
