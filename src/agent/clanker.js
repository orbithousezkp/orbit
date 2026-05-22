"use strict";

const { base } = require("viem/chains");
const { assertAddress, assertPrivateKey, isAddress } = require("./addresses");
const { TREASURY_PATH, loadTreasury, saveTreasury, syncRevenuePolicy } = require("./treasury");

const SECONDS_PER_DAY = 86_400;

function rewardSplit(config) {
  const operatorBps = config.operatorRevenueBps;
  if (!Number.isInteger(operatorBps) || operatorBps < 0 || operatorBps > 10000) {
    throw new Error("ORBIT_OPERATOR_REVENUE_BPS must be between 0 and 10000");
  }
  return {
    operatorBps,
    treasuryBps: 10000 - operatorBps
  };
}

function readiness(config) {
  const missing = [];
  if (!isAddress(config.operatorRevenueAddress)) missing.push("ORBIT_OPERATOR_REVENUE_ADDRESS");
  if (!isAddress(config.treasuryAddress)) missing.push("ORBIT_TREASURY_ADDRESS");
  if (!isAddress(config.tokenAdminAddress)) missing.push("ORBIT_TOKEN_ADMIN_ADDRESS");
  if (!config.walletPrivateKey) missing.push("ORBIT_WALLET_PRIVATE_KEY");

  return {
    readyToSign: missing.length === 0,
    missing
  };
}

function buildTokenConfig(config, cycle = 0) {
  const { operatorBps, treasuryBps } = rewardSplit(config);
  const tokenAdmin = assertAddress(config.tokenAdminAddress || config.treasuryAddress, "token admin address");
  const treasuryRecipient = assertAddress(config.treasuryAddress, "treasury address");
  const operatorRecipient = assertAddress(config.operatorRevenueAddress, "operator revenue address");

  const token = {
    name: config.tokenName,
    symbol: config.tokenSymbol,
    tokenAdmin,
    metadata: {
      description: config.tokenDescription,
      socialMediaUrls: [],
      auditUrls: []
    },
    context: {
      interface: "Orbit",
      platform: "GitHub Actions",
      messageId: `orbit-cycle-${cycle}`,
      id: "orbit-native-token"
    },
    rewards: {
      recipients: [
        {
          admin: tokenAdmin,
          recipient: operatorRecipient,
          bps: operatorBps,
          token: "Paired"
        },
        {
          admin: tokenAdmin,
          recipient: treasuryRecipient,
          bps: treasuryBps,
          token: "Paired"
        }
      ]
    },
    vault: {
      percentage: config.vaultPercentage,
      lockupDuration: config.vaultLockupDays * SECONDS_PER_DAY,
      vestingDuration: config.vaultVestingDays * SECONDS_PER_DAY,
      recipient: treasuryRecipient
    },
    vanity: true
  };

  if (config.tokenImageUri) token.image = config.tokenImageUri;
  if (config.devBuyEth > 0) {
    token.devBuy = {
      ethAmount: config.devBuyEth
    };
  }

  return token;
}

function prepareClankerLaunch(config, cycle = 0) {
  const status = readiness(config);
  let tokenConfig = null;
  let error = null;

  try {
    tokenConfig = status.missing.includes("ORBIT_OPERATOR_REVENUE_ADDRESS") ||
      status.missing.includes("ORBIT_TREASURY_ADDRESS") ||
      status.missing.includes("ORBIT_TOKEN_ADMIN_ADDRESS")
      ? null
      : buildTokenConfig(config, cycle);
  } catch (caught) {
    error = caught.message;
  }

  return {
    dryRun: !config.enableTokenLaunch,
    launchEnabled: config.enableTokenLaunch,
    readyToSign: status.readyToSign,
    missing: status.missing,
    revenuePolicy: {
      operatorShareBps: config.operatorRevenueBps,
      treasuryShareBps: 10000 - config.operatorRevenueBps,
      operatorSharePct: config.operatorRevenueBps / 100,
      treasurySharePct: (10000 - config.operatorRevenueBps) / 100,
      rewardToken: "Paired",
      expectedPairedAsset: "configured paired token"
    },
    tokenConfig,
    error
  };
}

async function makeClanker(config) {
  assertPrivateKey(config.walletPrivateKey, "ORBIT_WALLET_PRIVATE_KEY");
  const [{ Clanker }, viem, accounts] = await Promise.all([
    import("clanker-sdk/v4"),
    import("viem"),
    import("viem/accounts")
  ]);

  const account = accounts.privateKeyToAccount(config.walletPrivateKey);
  const transport = viem.http(config.baseRpcUrl || undefined);
  const publicClient = viem.createPublicClient({ chain: base, transport });
  const wallet = viem.createWalletClient({ account, chain: base, transport });

  return {
    account,
    clanker: new Clanker({ wallet, publicClient })
  };
}

async function launchNativeToken(config, cycle = 0) {
  const treasury = syncRevenuePolicy(config);
  if (treasury.token.launchStatus === "launched" && treasury.token.address) {
    return {
      status: "already_launched",
      address: treasury.token.address,
      txHash: treasury.token.txHash
    };
  }

  const prepared = prepareClankerLaunch(config, cycle);
  if (!config.enableTokenLaunch) {
    return {
      status: "dry_run",
      message: "Token launch is prepared but ORBIT_ENABLE_TOKEN_LAUNCH is not true.",
      prepared
    };
  }

  if (!prepared.readyToSign || !prepared.tokenConfig) {
    return {
      status: "blocked",
      message: "Token launch is enabled but required wallet/address configuration is missing.",
      prepared
    };
  }

  const { clanker } = await makeClanker(config);
  const deployment = await clanker.deploy(prepared.tokenConfig);
  if (deployment.error) throw deployment.error;

  const receipt = await deployment.waitForTransaction();
  if (receipt.error) throw receipt.error;

  treasury.token.launchStatus = "launched";
  treasury.token.address = receipt.address;
  treasury.token.txHash = deployment.txHash;
  treasury.token.launchedAt = new Date().toISOString();
  treasury.token.launchRequest = prepared.tokenConfig;
  saveTreasury(config.repoRoot, treasury);

  return {
    status: "launched",
    address: receipt.address,
    txHash: deployment.txHash,
    proofPath: TREASURY_PATH
  };
}

async function runRevenueCycle(config) {
  const treasury = loadTreasury(config.repoRoot, config);
  const token = treasury.token.address;
  const operatorRecipient = config.operatorRevenueAddress;

  if (!token) {
    return {
      status: "no_token",
      message: "No launched token address is recorded yet."
    };
  }

  assertAddress(token, "token address");
  assertAddress(operatorRecipient, "operator revenue address");

  if (!config.enableRevenueClaims) {
    return {
      status: "dry_run",
      message: "Revenue claim is prepared but ORBIT_ENABLE_REVENUE_CLAIMS is not true.",
      token,
      rewardRecipient: operatorRecipient
    };
  }

  const { clanker } = await makeClanker(config);
  const result = await clanker.claimRewards({
    token,
    rewardRecipient: operatorRecipient
  });

  treasury.revenue.lastClaimAttemptAt = new Date().toISOString();
  treasury.revenue.lastClaimResult = result.error
    ? { error: result.error.message || String(result.error) }
    : { txHash: result.txHash, rewardRecipient: operatorRecipient };
  saveTreasury(config.repoRoot, treasury);

  if (result.error) throw result.error;
  return {
    status: "claimed",
    token,
    rewardRecipient: operatorRecipient,
    txHash: result.txHash,
    proofPath: TREASURY_PATH
  };
}

module.exports = {
  buildTokenConfig,
  launchNativeToken,
  prepareClankerLaunch,
  rewardSplit,
  runRevenueCycle
};
