const fs = require("fs");
const path = require("path");
// Carregar .env base e opcional .env.<tag> (ENV_FILE/NODE_ENV/HARDHAT_NETWORK)
(() => {
  const base = path.join(__dirname, "..", ".env");
  if (fs.existsSync(base)) {
    require("dotenv").config({ path: base });
  } else {
    const rootBase = path.join(__dirname, "..", "..", ".env");
    if (fs.existsSync(rootBase)) require("dotenv").config({ path: rootBase });
  }
  const tag = process.env.ENV_FILE || process.env.NODE_ENV || process.env.HARDHAT_NETWORK;
  if (tag) {
    const localFile = tag.endsWith(".env") || tag.includes(".env.")
      ? (path.isAbsolute(tag) ? tag : path.join(__dirname, "..", tag))
      : path.join(__dirname, "..", `.env.${tag}`);
    const rootFile = tag.endsWith(".env") || tag.includes(".env.")
      ? (path.isAbsolute(tag) ? tag : path.join(__dirname, "..", "..", tag))
      : path.join(__dirname, "..", "..", `.env.${tag}`);
    if (fs.existsSync(localFile)) require("dotenv").config({ path: localFile, override: true });
    else if (fs.existsSync(rootFile)) require("dotenv").config({ path: rootFile, override: true });
  }
})();
const hre = require("hardhat");
const { ethers } = hre;
const config = require(path.join(__dirname, "..", "..", "config.json"));

async function main() {
  const addr = process.env.CONTRACT_ADDRESS;
  if (!addr || !ethers.isAddress(addr)) {
    throw new Error("Set CONTRACT_ADDRESS with a valid address to verify");
  }
  const [deployer] = await hre.ethers.getSigners();
  const WONE = process.env.WONE_ADDRESS;
  if (!WONE) throw new Error("Missing WONE_ADDRESS env");

  const rawRouters = [
    config.UNISWAP?.ROUTERS?.VIPERSWAP,
    config.UNISWAP?.ROUTERS?.SUSHISWAP,
    config.UNISWAP?.ROUTERS?.DFK,
    config.UNISWAP?.ROUTERS?.DEFIRA,
    config.UNISWAP?.ROUTERS?.SONICSWAP,
  ];
  const ROUTERS = [...new Set(
    rawRouters.filter((a) => a && ethers.isAddress(a))
  )];
  const cfg = config.INTERMEDIATE_TOKENS;
  let fromCfg = [];
  if (Array.isArray(cfg)) {
    fromCfg = cfg.map((v) => (typeof v === 'string' ? v : (v && v.address ? v.address : undefined))).filter(Boolean);
  } else if (cfg && typeof cfg === 'object') {
    fromCfg = Object.values(cfg).filter(Boolean);
  }
  const fromEnv = (process.env.INTERMEDIATES || "").split(",").map((s) => s.trim()).filter(Boolean);
  const INTERMEDIATES = [...new Set([...fromCfg, ...fromEnv].filter((a) => ethers.isAddress(a)))];
  const FEE_BPS = Number(process.env.FEE_BPS || 25);

  const constructorArguments = [
    deployer.address,
    WONE,
    ROUTERS,
    INTERMEDIATES,
    FEE_BPS,
  ];

  const attempts = Number(process.env.VERIFY_ATTEMPTS || 5);
  const delay = Number(process.env.VERIFY_DELAY_MS || 8000);
  for (let i = 1; i <= attempts; i++) {
    try {
      console.log(`Verifying ${addr} (attempt ${i}/${attempts})...`);
      await hre.run("verify:verify", { address: addr, constructorArguments });
      console.log("Verification submitted ✔");
      return;
    } catch (err) {
      const m = (err && (err.message || err.toString())) || "";
      // Sucesso imediato se já verificado
      if (/Contract source code already verified|Already Verified/i.test(m)) {
        console.log("Already verified ✔");
        return;
      }
      const retryable = /Try again later|Missing bytecode for contract|Unable to locate ContractCode|doesn't have bytecode/i.test(m);
      if (!retryable || i === attempts) {
        console.warn("Verification failed:", m);
        break;
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
