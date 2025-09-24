const { expect } = require("chai");

// Helpers
async function addr(of) {
  return of.getAddress ? await of.getAddress() : of.address;
}

async function deployToken(hre, name, symbol, decimals) {
  const T = await hre.ethers.getContractFactory("ERC20Mock");
  const t = await T.deploy(name, symbol, decimals);
  await (t.waitForDeployment ? t.waitForDeployment() : t.deployed());
  return t;
}

async function deployRouter(hre) {
  const R = await hre.ethers.getContractFactory("MockRouterV2");
  const r = await R.deploy();
  await (r.waitForDeployment ? r.waitForDeployment() : r.deployed());
  return r;
}

async function deployAggMulti(hre, owner, WETH, routers, inters, feeBps = 25) {
  const Agg = await hre.ethers.getContractFactory("AggregatorMultiSplit");
  const agg = await Agg.deploy(await addr(owner), await addr(WETH), routers, inters, feeBps);
  await (agg.waitForDeployment ? agg.waitForDeployment() : agg.deployed());
  return agg;
}

async function setMul(router, a, b, mulStr) {
  await (await router.setPriceMul(await addr(a), await addr(b), hre.ethers.parseUnits(mulStr))).wait();
}

/**
 * Testes completos para AggregatorMultiSplit + AggregatorV3 (admin/negativos)
 */
describe("AggregatorMultiSplit - suite completa", function () {
  it("admin: add/remove router & intermediate, set feeReceiver/WETH/feeBps (bounds)", async function () {
    const [owner, r1, r2, inter1, inter2, newReceiver, newWeth] = await ethers.getSigners();
    const routers = [r1.address, r2.address];
    const inters = [inter1.address, inter2.address];

    const Agg = await ethers.getContractFactory("AggregatorMultiSplit");
    const agg = await Agg.deploy(owner.address, newWeth.address, routers, inters, 25);
    await (agg.waitForDeployment ? agg.waitForDeployment() : agg.deployed());

    // routers
    expect([...await agg.getRouters()]).to.have.members(routers);
    await (await agg.addRouter((await ethers.getSigners())[7].address)).wait();
    const afterAddR = [...(await agg.getRouters())];
    expect(afterAddR.length).to.equal(3);
    await (await agg.removeRouter((await ethers.getSigners())[7].address)).wait();
    expect([...(await agg.getRouters())].length).to.equal(2);

    // intermediates
    expect([...(await agg.getIntermediates())]).to.have.members(inters);
    const extraInter = (await ethers.getSigners())[8].address;
    await (await agg.addIntermediate(extraInter)).wait();
    expect([...(await agg.getIntermediates())]).to.include(extraInter);
    await (await agg.removeIntermediate(extraInter)).wait();
    expect([...(await agg.getIntermediates())]).to.not.include(extraInter);

    // receivers/WETH/fee
    await (await agg.setFeeReceiver(newReceiver.address)).wait();
    expect(await agg.feeReceiver()).to.equal(newReceiver.address);

    await (await agg.setWETH(newWeth.address)).wait();
    expect(await agg.WETH()).to.equal(newWeth.address);

    await (await agg.setFeeBps(0)).wait();
    expect(Number(await agg.feeBps())).to.equal(0);
    await expect(agg.setFeeBps(2001)).to.be.revertedWith("Fee too high");
  });

  it("quotes: direto vs intermediates, verifica bestOut = getAmountsOut(bestRouter,bestPath)", async function () {
    const [owner] = await ethers.getSigners();

    // tokens
    const tokenIn = await deployToken(hre, "IN", "IN", 18);
    const tokenOut = await deployToken(hre, "OUT", "OUT", 18);
    const mid1 = await deployToken(hre, "MID1", "M1", 18);

    // routers
    const rA = await deployRouter(hre);
    const rB = await deployRouter(hre);

    // prefund out
    const big = ethers.parseUnits("10000000");
    await (await tokenOut.mint(await addr(rA), big)).wait();
    await (await tokenOut.mint(await addr(rB), big)).wait();

    // prices
    await (await rA.setPriceMul(await tokenIn.getAddress(), await tokenOut.getAddress(), ethers.parseUnits("1.00"))).wait();
    await (await rA.setPriceMul(await tokenIn.getAddress(), await mid1.getAddress(), ethers.parseUnits("1.10"))).wait();
    await (await rA.setPriceMul(await mid1.getAddress(), await tokenOut.getAddress(), ethers.parseUnits("1.10"))).wait();
    await (await rB.setPriceMul(await tokenIn.getAddress(), await tokenOut.getAddress(), ethers.parseUnits("1.05"))).wait();

    const agg = await deployAggMulti(hre, owner, tokenOut, [await addr(rA), await addr(rB)], [await addr(mid1)], 25);

    const amountIn = ethers.parseUnits("1000");
  const q = await agg.quote(amountIn, await tokenIn.getAddress(), await tokenOut.getAddress(), []);
  const bestOut = q[0];
  const bestRouter = q[1];
  const bestPath = q[2];
  const bestPathArr = [...bestPath]; // normalize ethers v6 Result -> plain array
  expect(bestOut > 0n).to.equal(true);
  // compute expected from router
  const router = await ethers.getContractAt("MockRouterV2", bestRouter);
  const amounts = await router.getAmountsOut(amountIn, bestPathArr);
  const amountsArr = [...amounts];
  const expectedOut = amountsArr[amountsArr.length - 1];
  expect(bestOut === expectedOut).to.equal(true);
  expect(bestPathArr.length >= 2).to.equal(true);
  });

  it("swaps: Token -> Token (split vs single) economiza slippage", async function () {
    const [owner, u] = await ethers.getSigners();
    const IN = await deployToken(hre, "IN", "IN", 18);
    const OUT = await deployToken(hre, "OUT", "OUT", 18);
    const M1 = await deployToken(hre, "M1", "M1", 18);
    const M2 = await deployToken(hre, "M2", "M2", 18);
    const rA = await deployRouter(hre);
    const rB = await deployRouter(hre);

    const big = ethers.parseUnits("10000000");
    await (await OUT.mint(await addr(rA), big)).wait();
    await (await OUT.mint(await addr(rB), big)).wait();

    // price setup: A via intermediates melhor que direto e que B
    await (await rA.setPriceMul(await IN.getAddress(), await OUT.getAddress(), ethers.parseUnits("1.00"))).wait();
    await (await rA.setPriceMul(await IN.getAddress(), await M1.getAddress(), ethers.parseUnits("1.10"))).wait();
    await (await rA.setPriceMul(await M1.getAddress(), await M2.getAddress(), ethers.parseUnits("1.10"))).wait();
    await (await rA.setPriceMul(await M2.getAddress(), await OUT.getAddress(), ethers.parseUnits("1.07"))).wait();
    await (await rB.setPriceMul(await IN.getAddress(), await OUT.getAddress(), ethers.parseUnits("1.05"))).wait();

    const agg = await deployAggMulti(hre, owner, OUT, [await addr(rA), await addr(rB)], [await addr(M1), await addr(M2)], 25);

    const amountIn = ethers.parseUnits("1000");
    await (await IN.mint(u.address, amountIn)).wait();
    await (await IN.connect(u).approve(await addr(agg), amountIn)).wait();

    await (await rB.setExecSlippageBps(200)).wait();

    const beforeSplit = await OUT.balanceOf(u.address);
    await (await agg.connect(u).swapMultiSplit(amountIn, await IN.getAddress(), await OUT.getAddress(), [], 2, Math.floor(Date.now()/1000)+3600)).wait();
    const afterSplit = await OUT.balanceOf(u.address);
    const recvSplit = afterSplit - beforeSplit;
    expect(recvSplit > 0n).to.equal(true);

    await (await IN.mint(u.address, amountIn)).wait();
    await (await IN.connect(u).approve(await addr(agg), amountIn)).wait();
    await (await rA.setExecSlippageBps(200)).wait();

    const beforeSingle = await OUT.balanceOf(u.address);
    await (await agg.connect(u).swapMultiSplit(amountIn, await IN.getAddress(), await OUT.getAddress(), [], 1, Math.floor(Date.now()/1000)+3600)).wait();
    const recvSingle = (await OUT.balanceOf(u.address)) - beforeSingle;

    expect(recvSplit >= recvSingle).to.equal(true);
  });

  it("swaps: Token -> WONE (WETH) e WONE -> Token", async function () {
    const [owner, u] = await ethers.getSigners();
    const IN = await deployToken(hre, "IN", "IN", 18);
    const WONE = await deployToken(hre, "WONE", "WONE", 18); // usando ERC20Mock como WETH
    const OUT = await deployToken(hre, "OUT", "OUT", 18);
    const rA = await deployRouter(hre);

    const big = ethers.parseUnits("10000000");
    await (await WONE.mint(await addr(rA), big)).wait();
    await (await OUT.mint(await addr(rA), big)).wait();

    // prices para IN->WONE e WONE->OUT
    await (await rA.setPriceMul(await IN.getAddress(), await WONE.getAddress(), ethers.parseUnits("1.20"))).wait();
    await (await rA.setPriceMul(await WONE.getAddress(), await OUT.getAddress(), ethers.parseUnits("0.90"))).wait();

    const agg = await deployAggMulti(hre, owner, WONE, [await addr(rA)], [], 25);

    const amountIn = ethers.parseUnits("1000");

    // Token -> WONE
    await (await IN.mint(u.address, amountIn)).wait();
    await (await IN.connect(u).approve(await addr(agg), amountIn)).wait();
    const beforeW = await WONE.balanceOf(u.address);
    await (await agg.connect(u).swapMultiSplit(amountIn, await IN.getAddress(), await WONE.getAddress(), [], 2, Math.floor(Date.now()/1000)+3600)).wait();
    const recW = (await WONE.balanceOf(u.address)) - beforeW;
    expect(recW > 0n).to.equal(true);

    // WONE -> Token
    await (await WONE.mint(u.address, amountIn)).wait();
    await (await WONE.connect(u).approve(await addr(agg), amountIn)).wait();
    const beforeT = await OUT.balanceOf(u.address);
    await (await agg.connect(u).swapMultiSplit(amountIn, await WONE.getAddress(), await OUT.getAddress(), [], 1, Math.floor(Date.now()/1000)+3600)).wait();
    const recT = (await OUT.balanceOf(u.address)) - beforeT;
    expect(recT > 0n).to.equal(true);
  });
});

// -------- AggregatorV3 (somente admin e negativos, pois _swap exige msg.sender ser router) --------
describe("AggregatorV3 (AggregatorV2MultiSplit) - admin & negativos", function () {
  it("admin functions e bounds", async function () {
    const [owner, r1, r2, newReceiver, w] = await ethers.getSigners();

    const AggV3 = await ethers.getContractFactory("AggregatorV2MultiSplit");
    const agg = await AggV3.deploy(owner.address, [r1.address, r2.address], 25);
    await (agg.waitForDeployment ? agg.waitForDeployment() : agg.deployed());

    await (await agg.addRouter((await ethers.getSigners())[7].address)).wait();
    await (await agg.removeRouter((await ethers.getSigners())[7].address)).wait();

    await (await agg.setFeeReceiver(newReceiver.address)).wait();
    expect(await agg.feeReceiver()).to.equal(newReceiver.address);

    await (await agg.setWETH(w.address)).wait();
    expect(await agg.WETH()).to.equal(w.address);

    await (await agg.setFeeBps(0)).wait();
    expect(Number(await agg.feeBps())).to.equal(0);
    await expect(agg.setFeeBps(2000)).to.be.revertedWith("Fee too high");
  });

  it("swapMultiSplit reverte (Router not allowed)", async function () {
    const [owner, r1] = await ethers.getSigners();
    const IN = await deployToken(hre, "IN", "IN", 18);
    const OUT = await deployToken(hre, "OUT", "OUT", 18);

    const AggV3 = await ethers.getContractFactory("AggregatorV2MultiSplit");
    const agg = await AggV3.deploy(owner.address, [r1.address], 25);
    await (agg.waitForDeployment ? agg.waitForDeployment() : agg.deployed());

    await (await IN.mint(owner.address, ethers.parseUnits("1000"))).wait();
    await (await IN.approve(await addr(agg), ethers.parseUnits("1000"))).wait();

    await expect(
      agg.swapMultiSplit(ethers.parseUnits("1000"), await IN.getAddress(), await OUT.getAddress(), [], 1, Math.floor(Date.now()/1000)+3600)
    ).to.be.revertedWith("Router not allowed");
  });
});
