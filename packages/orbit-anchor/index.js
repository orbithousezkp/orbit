"use strict";

const path = require("node:path");
const fs = require("node:fs");

const ABI = require("./abi.json");

const CHAIN_IDS = Object.freeze({
  base: 8453,
  baseSepolia: 84532
});

function loadContractSource() {
  return fs.readFileSync(
    path.join(__dirname, "contracts", "MerkleAnchor.sol"),
    "utf8"
  );
}

module.exports = {
  ABI,
  CHAIN_IDS,
  loadContractSource,
  CONTRACT_NAME: "MerkleAnchor",
  CONTRACT_PATH: "contracts/MerkleAnchor.sol"
};
