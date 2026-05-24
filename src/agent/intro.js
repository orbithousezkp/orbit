"use strict";

function shouldRunFirstWakeIntro(state = {}) {
  return Number(state.cycle || 0) === 1 && state.firstWakeIntroComplete !== true;
}

function buildFirstWakeIntro(config = {}, state = {}) {
  const brandName = config.brandName || "Orbit";
  const timestamp = state.lastActive || new Date().toISOString();

  return {
    kind: "first_wake_intro",
    title: `${brandName} first wake`,
    timestamp,
    summary: `${brandName} opens the GitHub repository control plane for the first time before normal work begins.`,
    controlPlane: {
      location: "GitHub repository",
      intake: "issues",
      heartbeat: "GitHub Actions",
      memory: "memory files",
      budget: "AI calls",
      walletPolicy: "treasury and governance files",
      receipts: "runtime proofs"
    },
    modules: [
      "attention",
      "memory",
      "treasury",
      "maintenance",
      "permissions",
      "proofs"
    ],
    next: "After this one-time intro, future cycles start directly with the safest useful repository action."
  };
}

module.exports = {
  buildFirstWakeIntro,
  shouldRunFirstWakeIntro
};
