"use strict";

const fs = require("fs");
const path = require("path");

const AI_PROVIDERS_PATH = "memory/ai-providers.json";
const REGISTRY_PROVIDER_DOMAINS = {};

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseIntEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeIntEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseNumberEnv(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseRatioEnv(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function splitCsv(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanBase(value) {
  return value ? String(value).replace(/\/+$/, "") : "";
}

function hostnameOf(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostMatches(hostname, domains) {
  const host = String(hostname || "").toLowerCase();
  return domains.some((domain) => {
    const normalized = String(domain || "").toLowerCase().replace(/^\*\./, "");
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

function providerConfigured(provider) {
  return Boolean(provider && provider.apiBase && provider.model && (provider.apiKey || provider.requiresAuth === false));
}

function parseJsonEnv(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function envName(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function normalizeProvider(raw = {}, env = {}, keyMap = {}, index = 0) {
  const name = raw.name || raw.id || `provider_${index + 1}`;
  const keyPrefix = envName(raw.envPrefix || raw.name || raw.id);
  const apiKeyEnv = raw.apiKeyEnv || (keyPrefix ? `${keyPrefix}_API_KEY` : "");
  const apiBaseEnv = raw.apiBaseEnv || (keyPrefix ? `${keyPrefix}_API_BASE` : "");
  const modelEnv = raw.modelEnv || (keyPrefix ? `${keyPrefix}_MODEL` : "");
  const apiKeyRef = raw.apiKeyRef || raw.keyRef || name;

  return {
    name,
    label: raw.label || name,
    enabled: raw.enabled !== false,
    apiKey: env[apiKeyEnv] || raw.apiKey || keyMap[apiKeyRef] || "",
    apiBase: cleanBase(env[apiBaseEnv] || raw.apiBase || ""),
    model: env[modelEnv] || raw.model || "",
    chatPath: raw.chatPath || "/chat/completions",
    requiresAuth: raw.requiresAuth !== false,
    authHeader: raw.authHeader || "Authorization",
    authScheme: raw.authScheme || "bearer",
    acceptEncoding: raw.acceptEncoding || "",
    toolResultMode: raw.toolResultMode || "native",
    extraHeaders: raw.extraHeaders && typeof raw.extraHeaders === "object" && !Array.isArray(raw.extraHeaders)
      ? raw.extraHeaders
      : {},
    apiKeyRef,
    apiKeyEnv,
    apiBaseEnv,
    modelEnv
  };
}

function providerDefinitions(env, repoRoot) {
  if (env.ORBIT_AI_PROVIDERS) {
    const configured = parseJsonEnv(env.ORBIT_AI_PROVIDERS, null);
    if (Array.isArray(configured)) {
      return {
        source: "env",
        providers: configured
      };
    }

    return {
      source: "env",
      providers: []
    };
  }

  const registry = readJsonFile(path.resolve(repoRoot, AI_PROVIDERS_PATH), { providers: [] });
  if (Array.isArray(registry.providers)) {
    return {
      source: "registry",
      providers: registry.providers
    };
  }

  return {
    source: "none",
    providers: []
  };
}

function registryProviderAllowed(provider, env = {}) {
  const apiBase = cleanBase(provider.apiBase || "");
  const hostname = hostnameOf(apiBase);
  if (!hostname) return false;
  const configured = splitCsv(env.ORBIT_AI_PROVIDER_ALLOWED_DOMAINS, []);
  const builtIn = REGISTRY_PROVIDER_DOMAINS[String(provider.name || "").toLowerCase()] || [];
  return hostMatches(hostname, [...builtIn, ...configured]);
}

function buildAiProviders(env, repoRoot = path.resolve(__dirname, "../..")) {
  const definitions = providerDefinitions(env, repoRoot);
  const providers = [...definitions.providers];
  const keyMap = parseJsonEnv(env.ORBIT_AI_PROVIDER_KEYS, {});

  if (!providers.length && (env.AI_API_KEY || env.OPENAI_API_KEY || env.AI_API_BASE || env.AI_MODEL)) {
    providers.push({
      name: "custom",
      label: "Custom OpenAI-compatible",
      apiKeyEnv: env.AI_API_KEY ? "AI_API_KEY" : "OPENAI_API_KEY",
      apiBase: env.AI_API_BASE || "",
      model: env.AI_MODEL || ""
    });
  }

  return providers
    .map((provider, index) => normalizeProvider(provider, env, keyMap, index))
    .filter((provider) => provider.enabled)
    .filter((provider) => definitions.source !== "registry" || registryProviderAllowed(provider, env))
    .filter(providerConfigured)
    .map((provider, index) => ({
      ...provider,
      priority: index + 1
    }));
}

function loadConfig(env = process.env) {
  const repoRoot = path.resolve(__dirname, "../..");
  const aiProviders = buildAiProviders(env, repoRoot);
  const isActions = parseBool(env.GITHUB_ACTIONS, false);
  const primaryProvider = aiProviders[0] || {
    apiKey: "",
    apiBase: "",
    model: ""
  };

  return {
    brandName: "Orbit",
    repoRoot,
    aiProviders,
    aiApiKey: primaryProvider.apiKey,
    aiApiBase: primaryProvider.apiBase,
    aiModel: primaryProvider.model,
    aiDailyBudgetUsd: parseNumberEnv(env.ORBIT_AI_DAILY_BUDGET_USD, 5),
    aiMonthlyBudgetUsd: parseNumberEnv(env.ORBIT_AI_MONTHLY_BUDGET_USD, 100),
    aiInputUsdPerMillion: parseNumberEnv(env.ORBIT_AI_INPUT_USD_PER_MILLION, 0.15),
    aiOutputUsdPerMillion: parseNumberEnv(env.ORBIT_AI_OUTPUT_USD_PER_MILLION, 0.6),
    aiFoodPurchaseProvider: env.ORBIT_AI_FOOD_PURCHASE_PROVIDER || "configured-ai-credit-provider",
    aiFoodPurchaseLabel: env.ORBIT_AI_FOOD_PURCHASE_LABEL || "configured AI-credit provider",
    aiFoodPurchaseUrl: env.ORBIT_AI_FOOD_PURCHASE_URL || "",
    aiFoodPurchaseMode: env.ORBIT_AI_FOOD_PURCHASE_MODE || "owner_approved_manual_credit_top_up",
    githubToken: env.GITHUB_TOKEN || env.GH_TOKEN || "",
    githubRepository: env.GITHUB_REPOSITORY || "",
    ownerUsername: env.ORBIT_OWNER_USERNAME || (env.GITHUB_REPOSITORY ? env.GITHUB_REPOSITORY.split("/")[0] : ""),
    approvalIssueLabel: env.ORBIT_APPROVAL_ISSUE_LABEL || "orbit:approval",
    approvalAcceptedLabel: env.ORBIT_APPROVAL_ACCEPTED_LABEL || "orbit:approved",
    approvalRejectedLabel: env.ORBIT_APPROVAL_REJECTED_LABEL || "orbit:rejected",
    maxSteps: parseIntEnv(env.ORBIT_MAX_STEPS, 8),
    dryRun: parseBool(env.ORBIT_DRY_RUN, !isActions),
    commitChanges: parseBool(env.ORBIT_COMMIT_CHANGES, isActions),
    pushChanges: parseBool(env.ORBIT_PUSH_CHANGES, isActions),
    cycleTrigger: env.ORBIT_CYCLE_TRIGGER || env.GITHUB_EVENT_NAME || (isActions ? "schedule" : "local"),
    cycleTriggerAction: env.ORBIT_CYCLE_TRIGGER_ACTION || env.GITHUB_EVENT_ACTION || "",
    allowCommands: parseBool(env.ORBIT_ALLOW_COMMANDS, false),
    commandAllowlist: splitCsv(env.ORBIT_COMMAND_ALLOWLIST, []),
    fetchAllowedDomains: splitCsv(env.ORBIT_FETCH_ALLOWED_DOMAINS, []),
    fetchMaxBytes: parseIntEnv(env.ORBIT_FETCH_MAX_BYTES, 80_000),
    fetchTimeoutMs: parseIntEnv(env.ORBIT_FETCH_TIMEOUT_MS, 12_000),
    allowRiskyFetch: parseBool(env.ORBIT_ALLOW_RISKY_FETCH, false),
    webSearchEndpoint: env.ORBIT_WEB_SEARCH_ENDPOINT || "",
    webSearchKey: env.ORBIT_WEB_SEARCH_KEY || "",
    proofDir: "runtime/proofs",
    publicBaseUrl: env.ORBIT_PUBLIC_URL || "",
    baseRpcUrl: env.ORBIT_BASE_RPC_URL || env.BASE_RPC_URL || env.RPC_URL || "",
    walletPrivateKey: env.ORBIT_WALLET_PRIVATE_KEY || env.PRIVATE_KEY || "",
    enableTokenLaunch: parseBool(env.ORBIT_ENABLE_TOKEN_LAUNCH, false),
    enableRevenueClaims: parseBool(env.ORBIT_ENABLE_REVENUE_CLAIMS, false),
    tokenName: env.ORBIT_TOKEN_NAME || "Orbit",
    tokenSymbol: env.ORBIT_TOKEN_SYMBOL || "ORBIT",
    tokenDescription: env.ORBIT_TOKEN_DESCRIPTION || "Orbit is a GitHub-native autonomous agent that funds its own work through public rewards.",
    tokenImageUri: env.ORBIT_TOKEN_IMAGE_URI || "",
    tokenAdminAddress: env.ORBIT_TOKEN_ADMIN_ADDRESS || "",
    treasuryAddress: env.ORBIT_TREASURY_ADDRESS || "",
    operatorRevenueAddress: env.ORBIT_OPERATOR_REVENUE_ADDRESS || "",
    operatorRevenueBps: parseNonNegativeIntEnv(env.ORBIT_OPERATOR_REVENUE_BPS, 0),
    revenueClaimIntervalDays: parseIntEnv(env.ORBIT_REVENUE_CLAIM_INTERVAL_DAYS, 7),
    revenuePerformanceWindowDays: parseIntEnv(env.ORBIT_REVENUE_PERFORMANCE_WINDOW_DAYS, 7),
    revenueMinCompletedCycles: parseNonNegativeIntEnv(env.ORBIT_REVENUE_MIN_COMPLETED_CYCLES, 3),
    revenueMinProductiveCycles: parseNonNegativeIntEnv(env.ORBIT_REVENUE_MIN_PRODUCTIVE_CYCLES, 1),
    revenueMinProductiveRatio: parseRatioEnv(env.ORBIT_REVENUE_MIN_PRODUCTIVE_RATIO, 0.25),
    vaultPercentage: parseNumberEnv(env.ORBIT_TOKEN_VAULT_PERCENTAGE, 10),
    vaultLockupDays: parseIntEnv(env.ORBIT_TOKEN_VAULT_LOCKUP_DAYS, 30),
    vaultVestingDays: parseIntEnv(env.ORBIT_TOKEN_VAULT_VESTING_DAYS, 30),
    devBuyEth: parseNumberEnv(env.ORBIT_DEV_BUY_ETH, 0)
  };
}

module.exports = {
  AI_PROVIDERS_PATH,
  REGISTRY_PROVIDER_DOMAINS,
  buildAiProviders,
  hostMatches,
  loadConfig,
  parseBool,
  parseNonNegativeIntEnv,
  parseNumberEnv,
  parseRatioEnv,
  splitCsv
};
