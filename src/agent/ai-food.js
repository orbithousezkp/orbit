"use strict";

const OPENROUTER_CREDITS_URL = "https://openrouter.ai/settings/credits";
const OPENROUTER_PROVIDER_NAME = "openrouter";

function normalizeProviderName(value) {
  return String(value || "").trim().toLowerCase();
}

function openRouterProvider(config = {}) {
  const providers = Array.isArray(config.aiProviders) ? config.aiProviders : [];
  return providers.find((provider) => normalizeProviderName(provider.name) === OPENROUTER_PROVIDER_NAME) || null;
}

function providerPriority(config = {}) {
  const providers = Array.isArray(config.aiProviders) ? config.aiProviders : [];
  return providers.map((provider) => ({
    name: provider.name,
    label: provider.label || provider.name,
    model: provider.model,
    priority: provider.priority
  }));
}

function openRouterUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === "openrouter.ai" || host.endsWith(".openrouter.ai")
      ? parsed.toString()
      : OPENROUTER_CREDITS_URL;
  } catch {
    return OPENROUTER_CREDITS_URL;
  }
}

function aiFoodPolicy(config = {}, treasury = {}) {
  const policy = treasury.ai && treasury.ai.purchasePolicy ? treasury.ai.purchasePolicy : {};
  const purchaseProvider = OPENROUTER_PROVIDER_NAME;
  const creditsUrl = openRouterUrl(policy.creditsUrl || OPENROUTER_CREDITS_URL);
  const routeMode = policy.mode || "owner_approved_manual_openrouter";

  return {
    inferencePriority: providerPriority(config),
    purchaseProvider,
    purchaseProviderLabel: "OpenRouter",
    creditsUrl,
    routeMode,
    purchaseOnlyOnOpenRouter: true,
    liveApiPurchase: false,
    reason: "FreeModel and OpenGateway can be inference providers, but Orbit only requests AI-credit purchases for OpenRouter."
  };
}

function assertOpenRouterPurchase(providerName) {
  const requested = normalizeProviderName(providerName || OPENROUTER_PROVIDER_NAME);
  if (requested !== OPENROUTER_PROVIDER_NAME) {
    throw new Error("AI credit purchases are restricted to OpenRouter.");
  }
  return requested;
}

function normalizeUsdAmount(amountUsd) {
  const amount = Number(amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amountUsd must be a positive number");
  }
  return Number(amount.toFixed(2));
}

function buildAiFoodRefillRequest(config, treasury, input = {}) {
  const provider = assertOpenRouterPurchase(input.provider || OPENROUTER_PROVIDER_NAME);
  const amountUsd = normalizeUsdAmount(input.amountUsd);
  const policy = aiFoodPolicy(config, treasury);
  const configuredProvider = openRouterProvider(config);

  return {
    category: "ai_food_refill",
    purpose: `Buy $${amountUsd.toFixed(2)} of Orbit AI-call food credits on OpenRouter`,
    asset: "USD credits",
    amount: amountUsd,
    recipient: "openrouter",
    url: policy.creditsUrl,
    notes: [
      "Purchase target is restricted to OpenRouter.",
      "FreeModel and OpenGateway remain inference-only fallback providers.",
      configuredProvider
        ? `Configured OpenRouter model: ${configuredProvider.model}.`
        : "OpenRouter inference provider is not configured yet, but it remains the only approved credit purchase target.",
      input.reason ? `Owner-visible reason: ${input.reason}` : ""
    ].filter(Boolean).join(" ")
  };
}

module.exports = {
  OPENROUTER_CREDITS_URL,
  OPENROUTER_PROVIDER_NAME,
  aiFoodPolicy,
  assertOpenRouterPurchase,
  buildAiFoodRefillRequest,
  openRouterProvider
};
