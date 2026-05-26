"use strict";

function normalizeProviderName(value) {
  return String(value || "").trim().toLowerCase();
}

function publicPurchaseProviderName() {
  return "configured-ai-credit-provider";
}

function configuredPurchaseProviderName(config = {}) {
  return normalizeProviderName(config.aiFoodPurchaseProvider) || publicPurchaseProviderName();
}

function configuredInferenceProvider(config = {}) {
  const purchaseProvider = configuredPurchaseProviderName(config);
  const providers = Array.isArray(config.aiProviders) ? config.aiProviders : [];
  return providers.find((provider) => normalizeProviderName(provider.name) === purchaseProvider) || null;
}

function providerPriority(config = {}) {
  const providers = Array.isArray(config.aiProviders) ? config.aiProviders : [];
  return providers.map((provider, index) => ({
    route: `private-ai-route-${Number(provider.priority) || index + 1}`,
    priority: Number(provider.priority) || index + 1
  }));
}

function configuredCreditUrl(config = {}, value) {
  const fallback = config.aiFoodPurchaseUrl || "";
  const raw = value || fallback;
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function aiFoodPolicy(config = {}, treasury = {}) {
  const policy = treasury.ai && treasury.ai.purchasePolicy ? treasury.ai.purchasePolicy : {};
  const purchaseUrlConfigured = Boolean(config.aiFoodPurchaseUrl || policy.creditsUrl);

  return {
    inferencePriority: providerPriority(config),
    purchaseProvider: publicPurchaseProviderName(),
    purchaseProviderLabel: "configured AI-credit provider",
    creditsUrl: "",
    purchaseUrlConfigured,
    routeMode: "owner_approved_manual_credit_top_up",
    purchaseOnlyOnConfiguredProvider: true,
    liveApiPurchase: false,
    reason: "Inference routes are separate from AI-credit purchases; Orbit only requests credit purchases through the configured owner-approved vendor."
  };
}

function assertConfiguredAiFoodPurchase(config = {}, providerName) {
  const publicProvider = publicPurchaseProviderName();
  const configuredProvider = configuredPurchaseProviderName(config);
  const requested = normalizeProviderName(providerName || configuredProvider);
  if (requested !== configuredProvider && requested !== publicProvider) {
    throw new Error("AI credit purchases are restricted to the configured owner-approved credit provider.");
  }
  return publicProvider;
}

function normalizeUsdAmount(amountUsd) {
  const amount = Number(amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amountUsd must be a positive number");
  }
  return Number(amount.toFixed(2));
}

function buildAiFoodRefillRequest(config, treasury, input = {}) {
  const provider = assertConfiguredAiFoodPurchase(config, input.provider);
  const amountUsd = normalizeUsdAmount(input.amountUsd);
  const policy = aiFoodPolicy(config, treasury);
  const configuredProvider = configuredInferenceProvider(config);
  const purchaseUrl = configuredCreditUrl(config);

  return {
    category: "ai_food_refill",
    purpose: `Buy $${amountUsd.toFixed(2)} of Orbit AI-call budget credits through the configured provider`,
    asset: "USD credits",
    amount: amountUsd,
    recipient: provider,
    url: purchaseUrl,
    notes: [
      "Purchase target is restricted to the configured owner-approved AI-credit provider.",
      "Inference route order remains separate from credit purchases.",
      configuredProvider
        ? "The configured credit provider is also present in the private inference route list."
        : "The configured credit provider is not required to be an inference route.",
      input.reason ? `Owner-visible reason: ${input.reason}` : ""
    ].filter(Boolean).join(" ")
  };
}

module.exports = {
  aiFoodPolicy,
  assertConfiguredAiFoodPurchase,
  buildAiFoodRefillRequest,
  configuredCreditUrl,
  configuredInferenceProvider,
  configuredPurchaseProviderName,
  publicPurchaseProviderName
};
