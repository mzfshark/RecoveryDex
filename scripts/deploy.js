#!/usr/bin/env node
// scripts/deploy.js
require('dotenv/config');
const { ethers, run } = require('hardhat');
const config = require('../config.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    console.error('❌ No deployer account found. Check network configuration.');
    process.exit(1);
  }
  const initialOwner = await deployer.getAddress();

  // Build router list and validate addresses (ethers v6 uses ethers.isAddress)
  const rawRouters = [
    config.UNISWAP?.ROUTERS?.VIPERSWAP,
    config.UNISWAP?.ROUTERS?.SUSHISWAP,
    config.UNISWAP?.ROUTERS?.DFK,
    config.UNISWAP?.ROUTERS?.SONICSWAP,
    config.UNISWAP?.ROUTERS?.DEFIRA
  ];
  const routerList = [...new Set(
    rawRouters.filter((addr) => {
      if (!addr) return false;
      const valid = ethers.isAddress(addr);
      if (!valid) console.warn(`⚠️ Invalid router skipped: ${addr}`);
      return valid;
    })
  )];
  if (!routerList.length) {
    console.error('❌ No valid router addresses found. Aborting.');
    process.exit(1);
  }

  const Factory = await ethers.getContractFactory('AggregatorV2');
  // Fee padrão 0.25% (25 bps), pode ser definido via env FEE_BPS
  const feeBpsEnv = process.env.FEE_BPS;
  const feeBps = feeBpsEnv !== undefined ? Number(feeBpsEnv) : 25;
  if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 1000) {
    throw new Error(`FEE_BPS inválido: ${feeBps}. Use um número entre 0 e 1000.`);
  }

  let gasLimit;
  try {
    console.log("🚀 Deploying with owner:", initialOwner);
    console.log("🔗 Routers:", routerList);
    console.log(`💸 Fee BPS: ${feeBps}`);
    if (!Array.isArray(routerList) || routerList.some((r) => !ethers.isAddress(r))) {
      throw new Error("❌ routerList must be a valid array of addresses");
    }
    const deployTx = Factory.getDeployTransaction(initialOwner, routerList, feeBps);
    const estimated = await deployer.estimateGas(deployTx);
    gasLimit = (estimated * 120n) / 100n; // 20% buffer
  } catch (err) {
    console.warn('⚠️ estimateGas failed or not supported, using fallback 5,000,000');
    gasLimit = 5000000n;
  }

  const aggregator = await Factory.deploy(initialOwner, routerList, feeBps, { gasLimit });
  await aggregator.waitForDeployment();

  const address = await aggregator.getAddress();
  const network = await ethers.provider.getNetwork();
  console.log(`✅ Deployed Aggregator at ${address} on ${network.name} (chainId ${network.chainId})`);

  const confirmations = network.chainId === 1n ? 6 : 1; // BigInt em ethers v6
  await (await aggregator.deploymentTransaction()).wait(Number(confirmations));

  // Opcional: configurar WETH se informado via env
  const wethAddress = process.env.WETH_ADDRESS;
  if (wethAddress && ethers.isAddress(wethAddress)) {
    console.log(`⚙️  Setting WETH to ${wethAddress} ...`);
    const tx = await aggregator.setWETH(wethAddress);
    await tx.wait(1);
    console.log('✅ WETH configured');
  }

  try {
    await run('verify:verify', {
      address,
      constructorArguments: [initialOwner, routerList, feeBps],
      contract: 'contracts/AggregatorV2.sol:AggregatorV2'
    });
    console.log('✅ Verification complete!');
  } catch (err) {
    console.warn('⚠️ Verification failed or skipped:', err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
