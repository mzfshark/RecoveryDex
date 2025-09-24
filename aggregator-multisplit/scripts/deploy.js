const fs = require("fs");
const path = require("path");
// Carregar .env base e opcional .env.<tag> (ENV_FILE/NODE_ENV/HARDHAT_NETWORK)
(() => {
  const base = path.join(__dirname, "..", ".env");
  if (fs.existsSync(base)) {
    require("dotenv").config({ path: base });
  } else {
    // fallback: raiz do repo
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
const config = require(path.join(__dirname, "..", "..", "config.json"));

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const { ethers } = hre;
  const WONE = process.env.WONE_ADDRESS;
  // Parametrização de gas e retry (legacy tx por compatibilidade com alguns RPCs)
  const GAS_PRICE_GWEI = process.env.GAS_PRICE_GWEI || "1"; // piso configurável
  const MAX_GAS_PRICE_GWEI = process.env.MAX_GAS_PRICE_GWEI; // teto opcional
  const GAS_BUMP_BPS = Number(process.env.GAS_BUMP_BPS || 1250); // 12.5% por tentativa
  const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 5);
  const GAS_LIMIT = Number(process.env.GAS_LIMIT || 6_000_000);
  const provider = ethers.provider;
  const feeData = await provider.getFeeData();
  const netGasPrice = feeData.gasPrice || 0n;
  const envGasPrice = ethers.parseUnits(GAS_PRICE_GWEI, "gwei");
  const capGasPrice = MAX_GAS_PRICE_GWEI ? ethers.parseUnits(MAX_GAS_PRICE_GWEI, "gwei") : undefined;
  const startGasPrice = netGasPrice > envGasPrice ? netGasPrice : envGasPrice;
  const pendingNonce = await provider.getTransactionCount(deployer.address, "pending");
  const baseOverrides = { gasLimit: GAS_LIMIT, type: 0, nonce: pendingNonce };

  async function tryDeployWithGas(gasPrice) {
    const AggregatorMultiSplit = await hre.ethers.getContractFactory("AggregatorMultiSplit");
    console.log(`Attempt deploy with gasPrice=${ethers.formatUnits(gasPrice, "gwei")} gwei, nonce=${baseOverrides.nonce}`);
    const aggregator = await AggregatorMultiSplit.deploy(
      deployer.address,
      WONE,
      ROUTERS,
      INTERMEDIATES,
      FEE_BPS,
      { ...baseOverrides, gasPrice }
    );
    if (aggregator.waitForDeployment) {
      await aggregator.waitForDeployment();
    } else if (aggregator.deployed) {
      await aggregator.deployed();
    }
    return aggregator;
  }

  // Build router list from config.json and validate addresses (ethers v6)
  const rawRouters = [
    config.UNISWAP?.ROUTERS?.VIPERSWAP,
    config.UNISWAP?.ROUTERS?.SUSHISWAP,
    config.UNISWAP?.ROUTERS?.DFK,
    config.UNISWAP?.ROUTERS?.DEFIRA,
    config.UNISWAP?.ROUTERS?.SONICSWAP,
  ];
  const ROUTERS = [...new Set(
    rawRouters.filter((addr) => {
      if (!addr) return false;
      const valid = ethers.isAddress(addr);
      if (!valid) console.warn(`⚠️ Invalid router skipped: ${addr}`);
      return valid;
    })
  )];
  if (!ROUTERS.length) {
    throw new Error("No valid router addresses found in config.json");
  }
  // Intermediários: combinar config.json (INTERMEDIATE_TOKENS) + env INTERMEDIATES
  const fromEnv = (process.env.INTERMEDIATES || "").split(",").map(s => s.trim()).filter(Boolean);
  const cfg = config.INTERMEDIATE_TOKENS;
  let fromCfg = [];
  if (Array.isArray(cfg)) {
    // pode ser array de strings ou de objetos { address }
    fromCfg = cfg
      .map((v) => (typeof v === 'string' ? v : (v && v.address ? v.address : undefined)))
      .filter(Boolean);
  } else if (cfg && typeof cfg === 'object') {
    // mapa { NAME: address }
    fromCfg = Object.values(cfg).filter(Boolean);
  }
  const INTERMEDIATES = [...new Set([...fromCfg, ...fromEnv].filter((addr) => {
    const ok = ethers.isAddress(addr);
    if (!ok) console.warn(`⚠️ Invalid intermediate skipped: ${addr}`);
    return ok;
  }))];
  const FEE_BPS = Number(process.env.FEE_BPS || 25);
  if (!WONE) throw new Error("Missing WONE_ADDRESS env");

  // Deploy com auto-bump de gas em caso de "underpriced"
  if (!WONE) throw new Error("Missing WONE_ADDRESS env");
  let attempt = 0;
  let currentGas = startGasPrice;
  let lastErr;
  while (attempt < MAX_ATTEMPTS) {
    try {
      const aggregator = await tryDeployWithGas(currentGas);
      const addr = aggregator.target || (aggregator.getAddress ? await aggregator.getAddress() : aggregator.address);
      console.log("AggregatorMultiSplit deployed to:", addr);
      // Tentativa de verificação automática (Blockscout/Etherscan compatível via @nomicfoundation/hardhat-verify)
      const constructorArgs = [
        deployer.address,
        WONE,
        ROUTERS,
        INTERMEDIATES,
        FEE_BPS,
      ];
      const verifyMax = Number(process.env.VERIFY_ATTEMPTS || 5);
      const verifyDelayMs = Number(process.env.VERIFY_DELAY_MS || 8000);
      for (let v = 1; v <= verifyMax; v++) {
        try {
          console.log(`Verifying (attempt ${v}/${verifyMax})...`);
          await hre.run("verify:verify", {
            address: addr,
            constructorArguments: constructorArgs,
          });
          console.log("Verification submitted ✔");
          break;
        } catch (verr) {
          const m = (verr && (verr.message || verr.toString())) || "";
          // Se já verificado, consideramos sucesso
          if (/Contract source code already verified|Already Verified/i.test(m)) {
            console.log("Already verified ✔");
            break;
          }
          // Mensagens comuns quando o indexador ainda não achou o bytecode
          const retryable = /Try again later|Missing bytecode for contract|Unable to locate ContractCode|doesn't have bytecode/i.test(m);
          if (!retryable || v === verifyMax) {
            console.warn("Verification skipped/failed:", m);
            break;
          }
          await new Promise((r) => setTimeout(r, verifyDelayMs));
        }
      }
      return;
    } catch (err) {
      const msg = (err && (err.message || err.toString())) || "";
      // Erros que justificam bump de gas
      const isUnderpriced = /underpriced|fee too low|replacement transaction underpriced/i.test(msg);
      const isNonce = /nonce too low|already known/i.test(msg);
      lastErr = err;
      if (!(isUnderpriced || isNonce)) {
        throw err;
      }
      attempt++;
      // bump
      const bump = (currentGas * BigInt(10000 + GAS_BUMP_BPS)) / 10000n;
      currentGas = bump;
      if (capGasPrice && currentGas > capGasPrice) {
        console.warn(`Reached MAX_GAS_PRICE_GWEI=${MAX_GAS_PRICE_GWEI}, stop retry.`);
        break;
      }
      console.warn(`Retry #${attempt} due to: ${msg}. Bumping gas to ${ethers.formatUnits(currentGas, "gwei")} gwei...`);
      // Pequeno atraso entre tentativas
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  // Se chegou aqui, falhou
  throw lastErr || new Error("Deployment failed after gas bump retries");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
