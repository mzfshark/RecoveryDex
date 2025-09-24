const { expect } = require("chai");
const { ethers } = require("hardhat");

const ONE = 10n ** 18n;

describe("AggregatorV2", function () {
  let tokenA, tokenB, tokenC, tokenD;
  let router1, router2;
  let aggregator;
  let owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

  const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
  const INITIAL = ONE * 1_000_000n;
  tokenA = await ERC20Mock.deploy("Token A", "TKA", owner.address, INITIAL);
  tokenB = await ERC20Mock.deploy("Token B", "TKB", owner.address, INITIAL);
  tokenC = await ERC20Mock.deploy("Token C", "TKC", owner.address, INITIAL);
  tokenD = await ERC20Mock.deploy("Token D", "TKD", owner.address, INITIAL);
  await tokenA.waitForDeployment();
  await tokenB.waitForDeployment();
  await tokenC.waitForDeployment();
  await tokenD.waitForDeployment();

    const MockRouterV2 = await ethers.getContractFactory("MockRouterV2");
  router1 = await MockRouterV2.deploy();
  router2 = await MockRouterV2.deploy();
  await router1.waitForDeployment();
  await router2.waitForDeployment();

    const Aggregator = await ethers.getContractFactory("AggregatorV2");
    // AggregatorV2 constructor: (address _owner, address[] _routers)
    // feeBps default = 25 (0.25%)
    aggregator = await Aggregator.deploy(
      owner.address,
      [router1.target, router2.target],
      25
    );
    await aggregator.waitForDeployment();

  // Ajuste para tornar a rota direta A->B pior que a rota 2-hop via C
  await router1.setPair(tokenA.target, tokenB.target, 100, 50);
  await router1.setPair(tokenA.target, tokenC.target, 5000, 5000);
  await router1.setPair(tokenC.target, tokenB.target, 5000, 10000);
  await router1.setPair(tokenA.target, tokenD.target, 1000, 1000);
  await router1.setPair(tokenD.target, tokenB.target, 1000, 500);

  // Pré-fundar o usuário com tokenA para aprovar e fazer swap
  await tokenA.transfer(user.address, ONE * 100n);
  // Pré-fundar o agregador com tokenB para simular recebimento do swap
  // (o MockRouterV2 não transfere tokens de fato)
  await tokenB.transfer(aggregator.target, ONE * 100000n);
  });

  it("should execute a correct 1-hop swap", async function () {
  await tokenA.connect(user).approve(aggregator.target, ONE);

    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;
    const tx = await aggregator.connect(user).swap(
      ONE,
  tokenA.target,
  tokenB.target,
      [],
      deadline
    );

    const receipt = await tx.wait();
    let parsed;
    for (const log of receipt.logs) {
      if (log.address !== aggregator.target) continue;
      try {
        const p = aggregator.interface.parseLog(log);
        if (p.name === "SwapExecuted") { parsed = p; break; }
      } catch (_) { /* not our event */ }
    }
    expect(parsed, "SwapExecuted event not found").to.not.be.undefined;
    const amountOut = parsed.args.amountOut; // bigint
    const feeAmount = parsed.args.feeAmount; // bigint
    expect(amountOut).to.be.gt(0n);
  const userBal = await tokenB.balanceOf(user.address);
    expect(userBal).to.equal(amountOut - feeAmount);
  });

  it("should select 2-hop over 3-hop route", async function () {
  await tokenA.connect(user).approve(aggregator.target, ONE);

    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;
    const result = await aggregator.connect(user).quote(
      ONE,
  tokenA.target,
  tokenB.target,
  [tokenC.target, tokenD.target]
    );

    // quote returns (bestOut, bestRouter, bestPath)
    expect(result.bestPath.length).to.equal(3); // tokenA -> tokenC -> tokenB
    expect(result.bestOut).to.be.gt(0n);
  });

  it("should execute swapWithPath with minOut", async function () {
    await tokenA.connect(user).approve(aggregator.target, ONE);
    // montar path 2-hop: A -> C -> B
    const path = [tokenA.target, tokenC.target, tokenB.target];
    const amounts = await router1.getAmountsOut(ONE, path);
    const expectedOut = amounts[amounts.length - 1];
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;
    const minOut = expectedOut - 1n;
    const tx = await aggregator.connect(user).swapWithPath(router1.target, path, ONE, minOut, deadline);
    const receipt = await tx.wait();
    let parsed;
    for (const log of receipt.logs) {
      if (log.address !== aggregator.target) continue;
      try { const p = aggregator.interface.parseLog(log); if (p.name === "SwapExecuted") { parsed = p; break; } } catch (_) {}
    }
    expect(parsed).to.not.be.undefined;
    expect(parsed.args.amountOut).to.be.gte(minOut);
  });

  it("should revert swapWithPath when minOut not met", async function () {
    await tokenA.connect(user).approve(aggregator.target, ONE);
    const path = [tokenA.target, tokenC.target, tokenB.target];
    const amounts = await router1.getAmountsOut(ONE, path);
    const tooHighMinOut = amounts[amounts.length - 1] + 1n;
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;
    await expect(
      aggregator.connect(user).swapWithPath(router1.target, path, ONE, tooHighMinOut, deadline)
    ).to.be.reverted; // Mock reverte com "insufficient output"
  });

  it("should honor user slippage in swapWithSlippage (0 bps)", async function () {
    await tokenA.connect(user).approve(aggregator.target, ONE);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;
    const tx = await aggregator.connect(user).swapWithSlippage(
      ONE,
      tokenA.target,
      tokenB.target,
      [],
      0, // 0 bps, deve passar pois mock não muda preço entre quote e swap
      deadline
    );
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });

  it("should apply proportional fee based on slippage", async function () {
    // Aumenta fee para 10% neste teste para evitar arredondamento a zero
    await aggregator.connect(owner).setFeeBps(1000);
    await tokenA.connect(user).approve(aggregator.target, ONE);

    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;
    const tx = await aggregator.connect(user).swap(
      ONE,
      tokenA.target,
      tokenB.target,
      [],
      deadline
    );
    const receipt = await tx.wait();
    let parsed;
    for (const log of receipt.logs) {
      if (log.address !== aggregator.target) continue;
      try {
        const p = aggregator.interface.parseLog(log);
        if (p.name === "SwapExecuted") { parsed = p; break; }
      } catch (_) { /* ignore */ }
    }
    expect(parsed, "SwapExecuted event not found").to.not.be.undefined;
    expect(parsed.args.feeAmount).to.be.gt(0n);
    expect(parsed.args.slippageBps).to.be.lte(2000n);
  });

  it("should allow owner to manage routers", async function () {
    const randomRouter = ethers.Wallet.createRandom().address;
    await expect(aggregator.connect(user).addRouter(randomRouter)).to.be.reverted;
    await aggregator.connect(owner).addRouter(randomRouter);
  expect(await aggregator.getRouterCount()).to.equal(3n);

    await aggregator.connect(owner).removeRouter(randomRouter);
  expect(await aggregator.getRouterCount()).to.equal(2n);
  });
});
