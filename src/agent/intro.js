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
    summary: `${brandName} opens the GitHub house for the first time before normal work begins.`,
    house: {
      location: "GitHub repository",
      frontDoor: "issues",
      heartbeat: "GitHub Actions",
      memory: "memory files",
      food: "AI calls",
      money: "treasury",
      diary: "runtime proofs"
    },
    members: [
      "attention",
      "memory",
      "treasury",
      "caretaker",
      "gatekeeper",
      "diarist"
    ],
    next: "After this one-time intro, future cycles start directly with the safest useful household action."
  };
}

module.exports = {
  buildFirstWakeIntro,
  shouldRunFirstWakeIntro
};
