#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { verifyProofFile } = require("./index");

const EXIT = {
  OK: 0,
  INVALID: 1,
  UNSIGNED: 2,
  USAGE: 3,
  IO: 4
};

function printHelp() {
  const lines = [
    "Usage: orbit-verify [options] <proof.json> [proof.json ...]",
    "",
    "Options:",
    "  --signer <address>   Require recovered signer to match this address.",
    "  --json               Emit machine-readable JSON per file.",
    "  --help, -h           Print this message.",
    "",
    "Exit codes:",
    "  0 all proofs verified",
    "  1 at least one signature failed verification",
    "  2 at least one proof was unsigned",
    "  3 usage error",
    "  4 file I/O or parse error"
  ];
  process.stdout.write(lines.join("\n") + "\n");
}

async function main(argv) {
  const args = argv.slice(2);
  let expectedSigner = null;
  let jsonOut = false;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") {
      printHelp();
      return EXIT.OK;
    }
    if (a === "--signer") {
      expectedSigner = args[++i];
      if (!expectedSigner) {
        process.stderr.write("--signer requires a value\n");
        return EXIT.USAGE;
      }
      continue;
    }
    if (a === "--json") {
      jsonOut = true;
      continue;
    }
    if (a.startsWith("--")) {
      process.stderr.write(`unknown flag: ${a}\n`);
      return EXIT.USAGE;
    }
    files.push(a);
  }
  if (!files.length) {
    printHelp();
    return EXIT.USAGE;
  }

  let worstExit = EXIT.OK;
  for (const file of files) {
    let proof;
    try {
      proof = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      process.stderr.write(`${file}: ${error.message}\n`);
      worstExit = Math.max(worstExit, EXIT.IO);
      continue;
    }

    let result;
    try {
      result = await verifyProofFile(proof, { expectedSigner });
    } catch (error) {
      process.stderr.write(`${file}: ${error.message}\n`);
      worstExit = Math.max(worstExit, EXIT.IO);
      continue;
    }

    if (jsonOut) {
      process.stdout.write(JSON.stringify({ file, ...result }) + "\n");
    } else {
      const status = result.verified
        ? "OK"
        : result.signed
          ? `INVALID (${result.reason || "unknown"})`
          : "UNSIGNED";
      const signer = result.signer || "-";
      const recovered = result.recovered || "-";
      process.stdout.write(`${file}: ${status}  signer=${signer}  recovered=${recovered}\n`);
    }

    if (!result.signed) {
      worstExit = Math.max(worstExit, EXIT.UNSIGNED);
    } else if (!result.verified) {
      worstExit = Math.max(worstExit, EXIT.INVALID);
    }
  }

  return worstExit;
}

if (require.main === module) {
  main(process.argv)
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write((error.stack || error.message) + "\n");
      process.exit(EXIT.IO);
    });
}

module.exports = { main, EXIT };
