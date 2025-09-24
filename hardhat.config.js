const fs = require("fs");
const path = require("path");

// Load base .env and an optional .env.<tag> (e.g., .env.dev)
(() => {
  const base = path.join(__dirname, ".env");
  if (fs.existsSync(base)) {
    require("dotenv").config({ path: base });
  }
  // Priority: ENV_FILE ("dev" or ".env.dev"), then NODE_ENV (e.g., dev/prod), then HARDHAT_NETWORK
  const tag = process.env.ENV_FILE || process.env.NODE_ENV || process.env.HARDHAT_NETWORK;
  if (tag) {
    const file = tag.endsWith(".env") || tag.includes(".env.")
      ? (path.isAbsolute(tag) ? tag : path.join(__dirname, tag))
      : path.join(__dirname, `.env.${tag}`);
    if (fs.existsSync(file)) {
      require("dotenv").config({ path: file, override: true });
      // console.log(`Loaded env file: ${file}`);
    }
  }
})();
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("solidity-coverage");
// path already required above

const env = process.env;

// Utilitário para derivar browserURL a partir do apiURL (remove sufixo "/api")
function deriveBrowserURL(apiUrl) {
  if (!apiUrl) return "";
  try {
    const u = new URL(apiUrl);
    // se terminar com /api, remover
    if (u.pathname.endsWith("/api")) {
      u.pathname = u.pathname.replace(/\/?api$/, "");
    }
    return `${u.origin}${u.pathname}`;
  } catch {
    return "";
  }
}

task("deploy:multisplit", "Deploy AggregatorMultiSplit on Harmony").setAction(async (_, hre) => {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const AggregatorMultiSplit = await hre.ethers.getContractFactory("AggregatorMultiSplit");
  const WONE = env.WONE_ADDRESS;
  const ROUTERS = (env.ROUTERS || "").split(",").filter(Boolean);
  const INTERMEDIATES = (env.INTERMEDIATES || "").split(",").filter(Boolean);
  const FEE_BPS = Number(env.FEE_BPS || 25);
  if (!WONE || ROUTERS.length === 0) throw new Error("Missing WONE_ADDRESS or ROUTERS env");

  const aggregator = await AggregatorMultiSplit.deploy(
    deployer.address,
    WONE,
    ROUTERS,
    INTERMEDIATES,
    FEE_BPS
  );

  if (aggregator.waitForDeployment) {
    await aggregator.waitForDeployment();
  } else if (aggregator.deployed) {
    await aggregator.deployed();
  }
  const addr = aggregator.target || (aggregator.getAddress ? await aggregator.getAddress() : aggregator.address);
  console.log("AggregatorMultiSplit deployed to:", addr);
});

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: {
    version: "0.8.18",
    settings: {
      // viaIR habilitado mesmo em coverage para evitar "Stack too deep" durante instrumentação
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
    },
  },
  etherscan: {
    apiKey: {
      harmony: env.ETHERSCAN_API_KEY_HARMONY || env.ETHERSCAN_API_KEY || "blockscout",
      harmonyTestnet: env.ETHERSCAN_API_KEY_HARMONY_TESTNET || env.ETHERSCAN_API_KEY || "blockscout",
    },
    customChains: (() => {
      const apiHarmony = env.ETHERSCAN_API_URL_HARMONY || env.HARMONY_EXPLORER_API_URL || "";
      const apiHarmonyTest = env.ETHERSCAN_API_URL_HARMONY_TESTNET || env.HARMONY_EXPLORER_API_URL_TESTNET || "https://explorer.testnet.harmony.one/api";
      const browserHarmony = env.ETHERSCAN_BROWSER_URL_HARMONY || deriveBrowserURL(apiHarmony);
      const browserHarmonyTest = env.ETHERSCAN_BROWSER_URL_HARMONY_TESTNET || deriveBrowserURL(apiHarmonyTest);
      return [
        {
          network: "harmony",
          chainId: 1666600000,
          urls: {
            apiURL: apiHarmony,
            browserURL: browserHarmony,
          },
        },
        {
          network: "harmonyTestnet",
          chainId: 1666700000,
          urls: {
            apiURL: apiHarmonyTest,
            browserURL: browserHarmonyTest,
          },
        },
      ];
    })(),
  },
  paths: {
    sources: path.join(__dirname, "contracts"),
    tests: path.join(__dirname, "test"),
    cache: path.join(__dirname, "cache"),
    artifacts: path.join(__dirname, "artifacts"),
    scripts: path.join(__dirname, "scripts"),
  },
  networks: {
    harmony: {
      url: env.RPC_URL_HARMONY || "https://api.harmony.one",
      accounts: env.DEPLOYER_PRIVATE_KEY ? [
        env.DEPLOYER_PRIVATE_KEY.startsWith("0x") ? env.DEPLOYER_PRIVATE_KEY : `0x${env.DEPLOYER_PRIVATE_KEY}`
      ] : [],
    },
    harmonyTestnet: {
      url: env.RPC_TESTNET_HARMONY || "https://api.s0.b.hmny.io",
      accounts: env.DEPLOYER_PRIVATE_KEY ? [
        env.DEPLOYER_PRIVATE_KEY.startsWith("0x") ? env.DEPLOYER_PRIVATE_KEY : `0x${env.DEPLOYER_PRIVATE_KEY}`
      ] : [],
    },
  },
};

module.exports = config;
