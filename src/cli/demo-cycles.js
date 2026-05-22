#!/usr/bin/env node
"use strict";

const { buildFirstWakeIntro } = require("../agent/intro");

const cycles = [
  {
    cycle: 1,
    foodBefore: 100,
    foodAfter: 96,
    moneyBefore: 0,
    moneyAfter: 0,
    signal: "The GitHub house opens for the first time.",
    thought: "Name the rooms, members, food, money, locks, and diary before doing normal work.",
    action: "Write first-wake intro and start the household proof trail."
  },
  {
    cycle: 2,
    driver: "state:needs_income",
    foodBefore: 96,
    foodAfter: 92,
    moneyBefore: 0,
    moneyAfter: 0,
    signal: "Food exists but income is zero.",
    thought: "The household should preserve AI-call food and look for ways to earn from existing skills.",
    action: "Create opportunity: paid repo safety and treasury audit."
  },
  {
    cycle: 3,
    driver: "mandatory:regular_heartbeat",
    foodBefore: 92,
    foodAfter: 86,
    moneyBefore: 0,
    moneyAfter: 0,
    signal: "The house already has scam scanning, spend gates, memory, and proofs.",
    thought: "Existing rooms can become a paid service without building a large new feature first.",
    action: "Score the audit idea as low risk, medium reward, and low setup cost."
  },
  {
    cycle: 4,
    driver: "mandatory:regular_heartbeat",
    foodBefore: 86,
    foodAfter: 80,
    moneyBefore: 0,
    moneyAfter: 0,
    signal: "The offer can be described from existing household abilities.",
    thought: "Package what the members already do: inspect, guard, report, and write proof.",
    action: "Draft public offer: GitHub repo safety audit with proof notes."
  },
  {
    cycle: 5,
    driver: "state:needs_income",
    foodBefore: 80,
    foodAfter: 76,
    moneyBefore: 0,
    moneyAfter: 0,
    signal: "The offer is money-facing.",
    thought: "The gatekeeper should not let the house advertise paid work without owner approval.",
    action: "Open approval request with scope, food cost, expected income, and risks."
  },
  {
    cycle: 6,
    driver: "event:owner_manual_wake",
    foodBefore: 76,
    foodAfter: 70,
    moneyBefore: 0,
    moneyAfter: 0,
    signal: "Owner approval is accepted in the demo.",
    thought: "Now outreach is allowed, but food should still be rationed.",
    action: "Publish the offer and watch the front door for paid visitors."
  },
  {
    cycle: 7,
    driver: "event:front_door_activity",
    foodBefore: 70,
    foodAfter: 64,
    moneyBefore: 0,
    moneyAfter: 25,
    signal: "A visitor asks for a repo review.",
    thought: "This can feed the house if the scope is small and the request is safe.",
    action: "Risk-scan the request, estimate food cost, and ask for payment terms."
  },
  {
    cycle: 8,
    driver: "event:front_door_activity",
    foodBefore: 64,
    foodAfter: 58,
    moneyBefore: 25,
    moneyAfter: 25,
    signal: "Payment terms are present, but no heavy work has started.",
    thought: "Do the smallest paid chore first, then write proof before spending more food.",
    action: "Accept first audit step: inspect public workflow, memory, and treasury gates."
  },
  {
    cycle: 9,
    driver: "state:needs_income",
    foodBefore: 58,
    foodAfter: 48,
    moneyBefore: 25,
    moneyAfter: 100,
    signal: "The first paid audit step finds useful issues.",
    thought: "Deliver value, record proof, and increase household money before expanding scope.",
    action: "Write audit note, deliver findings, and record earned income."
  },
  {
    cycle: 10,
    driver: "mandatory:regular_heartbeat",
    foodBefore: 48,
    foodAfter: 45,
    moneyBefore: 100,
    moneyAfter: 100,
    signal: "The household has less food but more money and a repeatable earning path.",
    thought: "Use money to buy more food, improve the house, and queue the next earning idea.",
    action: "Plan refill, archive lessons, and create next opportunity from repeated chores."
  }
];

function money(value) {
  return `$${value}`;
}

function printCycle(cycle) {
  console.log(`Cycle ${cycle.cycle}`);
  console.log(`  driver: ${cycle.driver || "intro:first_wake"}`);
  console.log(`  food:  ${cycle.foodBefore} -> ${cycle.foodAfter} AI-call units`);
  console.log(`  money: ${money(cycle.moneyBefore)} -> ${money(cycle.moneyAfter)}`);
  console.log(`  signal: ${cycle.signal}`);
  console.log(`  thought: ${cycle.thought}`);
  console.log(`  action: ${cycle.action}`);
  console.log("");
}

function main() {
  const intro = buildFirstWakeIntro(
    { brandName: "Orbit" },
    { cycle: 1, lastActive: "demo-cycle-1" }
  );

  console.log("Orbit first 10-cycle household demo");
  console.log("This is a simulation only. It does not mutate memory, treasury, or proofs.");
  console.log("Drivers: state = internal condition, event = GitHub activity, mandatory = regular 30-minute heartbeat.");
  console.log("");
  console.log(`Intro: ${intro.summary}`);
  console.log(`House: ${intro.house.location}; food: ${intro.house.food}; money: ${intro.house.money}; diary: ${intro.house.diary}`);
  console.log(`Members: ${intro.members.join(", ")}`);
  console.log("");

  for (const cycle of cycles) {
    printCycle(cycle);
  }

  console.log("Result after 10 cycles");
  console.log("  food: 45 AI-call units left");
  console.log("  money: $100 household money");
  console.log("  learned: paid repo safety audit is a repeatable earning path");
  console.log("  next: refill food, improve the house, and score the next opportunity");
}

main();
