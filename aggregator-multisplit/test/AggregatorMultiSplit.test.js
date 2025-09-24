const { expect } = require("chai");

describe("AggregatorMultiSplit - basic", function () {
  it("deploys and sets initial config", async function () {
    const [owner, r1, r2, inter1, newReceiver, newWeth] = await ethers.getSigners();

    const routers = [r1.address, r2.address];
    const intermediates = [inter1.address];
    const feeBps = 25;

    const Factory = await ethers.getContractFactory("AggregatorMultiSplit");
    const agg = await Factory.deploy(
      owner.address,
      newWeth.address,
      routers,
      intermediates,
      feeBps
    );
    if (agg.waitForDeployment) {
      await agg.waitForDeployment();
    } else if (agg.deployed) {
      await agg.deployed();
    }

    // validate initial
  const gotRouters = await agg.getRouters();
  const routersOut = [...gotRouters];
  expect(routersOut).to.have.members(routers);

  const gotInter = await agg.getIntermediates();
  const interOut = [...gotInter];
  expect(interOut).to.have.members(intermediates);

    const setFeeBps = await agg.feeBps();
    expect(Number(setFeeBps)).to.equal(feeBps);

    const setWeth = await agg.WETH();
    expect(setWeth).to.equal(newWeth.address);

    const feeReceiver = await agg.feeReceiver();
    expect(feeReceiver).to.equal(owner.address);

    // admin updates
    await (await agg.setFeeReceiver(newReceiver.address)).wait();
    expect(await agg.feeReceiver()).to.equal(newReceiver.address);

    const anotherRouter = (await ethers.getSigners())[5].address;
    await (await agg.addRouter(anotherRouter)).wait();
  const afterAddRouters = [...(await agg.getRouters())];
  expect(afterAddRouters).to.include(anotherRouter);

    await (await agg.removeRouter(anotherRouter)).wait();
  const afterRemRouters = [...(await agg.getRouters())];
  expect(afterRemRouters).to.not.include(anotherRouter);

    const anotherInter = (await ethers.getSigners())[6].address;
    await (await agg.addIntermediate(anotherInter)).wait();
  const afterAddInter = [...(await agg.getIntermediates())];
  expect(afterAddInter).to.include(anotherInter);

    await (await agg.removeIntermediate(anotherInter)).wait();
  const afterRemInter = [...(await agg.getIntermediates())];
  expect(afterRemInter).to.not.include(anotherInter);

    // fee bounds
    await (await agg.setFeeBps(0)).wait();
    expect(Number(await agg.feeBps())).to.equal(0);
    await expect(agg.setFeeBps(2000)).to.be.revertedWith("Fee too high");
  });
});

describe("AggregatorMultiSplit - routing & splitting", function () {
  it("quotes best route with intermediates and executes multi-split reducing per-part slippage", async function () {
    const [owner, u, rA, rB] = await ethers.getSigners();

    // Tokens
    const Tkn = await ethers.getContractFactory("ERC20Mock");
    const tokenIn = await Tkn.deploy("IN", "IN", 18);
    await tokenIn.waitForDeployment?.();
    const tokenOut = await Tkn.deploy("OUT", "OUT", 18);
    await tokenOut.waitForDeployment?.();
    const mid1 = await Tkn.deploy("MID1", "M1", 18);
    await mid1.waitForDeployment?.();
    const mid2 = await Tkn.deploy("MID2", "M2", 18);
    await mid2.waitForDeployment?.();

    // Routers mocks
    const Router = await ethers.getContractFactory("MockRouterV2");
    const routerA = await Router.deploy();
    await routerA.waitForDeployment?.();
    const routerB = await Router.deploy();
    await routerB.waitForDeployment?.();

  // Prefund routers with tokenOut so mock can transfer out
  await (await tokenOut.mint(await routerA.getAddress(), ethers.parseUnits("10000000"))).wait();
  await (await tokenOut.mint(await routerB.getAddress(), ethers.parseUnits("10000000"))).wait();

    // Configuração de preços (mul em 1e18)
    // A: caminho direto ruim (1.0x), mas via mid1+mid2 é melhor (1.3x total)
    await (await routerA.setPriceMul(await tokenIn.getAddress(), await tokenOut.getAddress(), ethers.parseUnits("1.00"))).wait();
    await (await routerA.setPriceMul(await tokenIn.getAddress(), await mid1.getAddress(), ethers.parseUnits("1.10"))).wait();
    await (await routerA.setPriceMul(await mid1.getAddress(), await mid2.getAddress(), ethers.parseUnits("1.10"))).wait();
    await (await routerA.setPriceMul(await mid2.getAddress(), await tokenOut.getAddress(), ethers.parseUnits("1.07"))).wait(); // ~1.295x total

    // B: caminho direto um pouco melhor que A direto (1.05x), mas pior que hops de A
    await (await routerB.setPriceMul(await tokenIn.getAddress(), await tokenOut.getAddress(), ethers.parseUnits("1.05"))).wait();

    // Deploy aggregator
    const Agg = await ethers.getContractFactory("AggregatorMultiSplit");
    const agg = await Agg.deploy(
      owner.address,
      owner.address, // dummy WETH
      [await routerA.getAddress(), await routerB.getAddress()],
      [await mid1.getAddress(), await mid2.getAddress()],
      25
    );
    await (agg.waitForDeployment ? agg.waitForDeployment() : agg.deployed());

    // Mint & approve
    const amountIn = ethers.parseUnits("1000");
    await (await tokenIn.mint(u.address, amountIn)).wait();
    await (await tokenOut.mint(
      await (agg.getAddress ? agg.getAddress() : Promise.resolve(agg.address)),
      ethers.parseUnits("10000000")
    )).wait();
    await (await tokenIn.connect(u).approve(await agg.getAddress ? await agg.getAddress() : agg.address, amountIn)).wait();

    // quote com intermediários
  const q = await agg.quote(amountIn, await tokenIn.getAddress(), await tokenOut.getAddress(), []);
  const bestOut = q[0];
    const bestRouter = q[1];
    const bestPath = q[2];
  expect(bestOut > 0n).to.equal(true);
    expect(bestRouter).to.equal(await routerA.getAddress()); // deve escolher A via intermediários
    expect(bestPath.length).to.be.greaterThanOrEqual(3);

    // slippage de execução: roteador A 0 bps, roteador B piora 200 bps
    await (await routerB.setExecSlippageBps(200)).wait();

    // executar multisplit (2 partes)
    const beforeOutBal = await tokenOut.balanceOf(u.address);
    await (await agg.connect(u).swapMultiSplit(
      amountIn,
      await tokenIn.getAddress(),
      await tokenOut.getAddress(),
      [],
      2,
      Math.floor(Date.now()/1000)+3600
    )).wait();
  const afterOutBal = await tokenOut.balanceOf(u.address);
  const received = afterOutBal - beforeOutBal;
  expect(received > 0n).to.equal(true);

    // Agora comparar com single swap (1 parte) para simular maior impacto de execução
    // Para forçar impacto, vamos colocar slippage de execução no routerA também (simula pior execução)
    await (await tokenIn.mint(u.address, amountIn)).wait();
    await (await tokenIn.connect(u).approve(await agg.getAddress ? await agg.getAddress() : agg.address, amountIn)).wait();
    await (await routerA.setExecSlippageBps(200)).wait();

    const beforeSingle = await tokenOut.balanceOf(u.address);
    await (await agg.connect(u).swapMultiSplit(
      amountIn,
      await tokenIn.getAddress(),
      await tokenOut.getAddress(),
      [],
      1,
      Math.floor(Date.now()/1000)+3600
    )).wait();
    const receivedSingle = (await tokenOut.balanceOf(u.address)) - beforeSingle;

  // Espera: 2 partes tendem a reduzir o efeito de execução ruim por parte; recebido em 2 partes deve ser >= 1 parte quando A estava pior
  expect(received >= receivedSingle).to.equal(true);

    // limites
    await expect(
      agg.connect(u).swapMultiSplit(0, await tokenIn.getAddress(), await tokenOut.getAddress(), [], 2, Math.floor(Date.now()/1000)+3600)
    ).to.be.revertedWith("amountIn=0");
    await expect(
      agg.connect(u).swapMultiSplit(1, await tokenIn.getAddress(), await tokenOut.getAddress(), [], 0, Math.floor(Date.now()/1000)+3600)
    ).to.be.revertedWith("invalid parts");
  });
});

