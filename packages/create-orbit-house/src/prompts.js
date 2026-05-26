"use strict";

const readline = require("readline/promises");
const detect = require("./detect");

async function interactive(opts) {
  if (opts.yes) return {};
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answers = {};
    if (!opts.targetDir) {
      const a = (await rl.question("target directory (e.g. ./my-orbit-repo): ")).trim();
      if (a) answers.targetDir = a;
    }
    if (!opts.agentName || opts.agentName === "orbit") {
      const a = (await rl.question("agent name [orbit]: ")).trim();
      if (a) answers.agentName = a;
    }
    if (!opts.owner) {
      const a = (await rl.question("github owner username: ")).trim();
      if (a) answers.owner = a;
    }
    return answers;
  } finally {
    rl.close();
  }
}

async function confirmIfNonEmpty(targetDir) {
  if (!detect.directoryIsNonEmpty(targetDir)) return true;
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const a = (await rl.question(`directory ${targetDir} is not empty. continue? [y/N]: `)).trim().toLowerCase();
    return a === "y" || a === "yes";
  } finally {
    rl.close();
  }
}

module.exports = { interactive, confirmIfNonEmpty };
