import { ethers } from "ethers";
// Usa o ABI do novo contrato AggregatorMultiSplit
import AggregatorArtifact from "../abis/AggregatorMultiSplit.json";
import ERC20ABI from "../abis/ERC20ABI.json";
import { getProvider } from "../services/provider.js";
import { notify } from "./notificationService.js";
import allowanceCache from "./allowanceCache.js";

/**
 * AggregatorMultiSplit Service
 * 
 * CORRECT FLOW FOR SWAPS:
 * 
 * 1. ERC20 Token -> ERC20 Token:
 *    - Approve tokenIn for the contract
 *    - Call swapMultiSplit(amountIn, tokenIn, tokenOut, intermediates, parts, deadline)
 * 
 * 2. Native ONE -> ERC20 Token:
 *    - Convert ONE to WONE (wrap via deposit)
 *    - Approve WONE for the contract
 *    - Call swapMultiSplit(amountIn, WONE_ADDRESS, tokenOut, intermediates, parts, deadline)
 * 
 * 3. ERC20 Token -> Native ONE:
 *    - Approve tokenIn for the contract
 *    - Call swapMultiSplit(amountIn, tokenIn, WONE_ADDRESS, intermediates, parts, deadline)
 *    - Convert received WONE to ONE (unwrap via withdraw)
 * 
 * The contract automatically splits the order into 'parts' and finds the best routes
 * for each part, charging a configurable fee at the end.
 */

// Extract ABI from Hardhat artifact
const AggregatorABI = AggregatorArtifact.abi;

function getContract(signer) {
  const addr = import.meta.env.VITE_AGGREGATOR_ADDRESS;
  if (!addr || !ethers.isAddress(addr)) {
    console.warn("[AggregatorService] Missing/invalid AGGREGATOR_ADDRESS");
    return null; // doesn't break render
  }
  const runner = signer ?? getProvider();
  if (!runner) {
    console.warn("[AggregatorService] Provider/Signer unavailable");
    return null;
  }
  return new ethers.Contract(addr, AggregatorABI, runner);
}

export function getAggregatorAddress() {
  const addr = import.meta.env.VITE_AGGREGATOR_ADDRESS;
  return addr && ethers.isAddress(addr) ? addr : null;
}

function getTxOverrides() {
  try {
    const lim = BigInt(import.meta.env?.VITE_SWAP_GAS_LIMIT || '0');
    const gwei = import.meta.env?.VITE_GAS_PRICE_GWEI;
    const ov = {};
    if (lim > 0n) ov.gasLimit = lim;
    if (gwei && Number(gwei) > 0) {
      ov.gasPrice = BigInt(Math.floor(Number(gwei) * 1e9));
    }
    if (Object.keys(ov).length) return ov;
  } catch {/* ignore */}
  // fallback conservative; avoids estimateGas on problematic RPCs
  return { gasLimit: 600000n };
}

export function getMaxParts() {
  try {
    const max = Number(import.meta.env?.VITE_DEFAULT_PARTS || 1);
    return Math.max(1, max | 0);
  } catch {
    return 1;
  }
}

function ensureSigner(signer) {
  if (!signer) throw new Error("[AggregatorService] signer is required for this operation");
}

// Wait for a specific number of blocks before proceeding
async function waitForBlocks(provider, targetBlocks = 3) {
  console.log(`[AggregatorService] Waiting for ${targetBlocks} blocks for better indexation...`);
  notify.info("Waiting", `Waiting for ${targetBlocks} blocks for indexation...`, 14000);
  
  try {
    const startBlock = await provider.getBlockNumber();
    console.log(`[AggregatorService] Starting block: ${startBlock}, target: ${startBlock + targetBlocks}`);
    
    let currentBlock = startBlock;
    while (currentBlock < startBlock + targetBlocks) {
      await new Promise(resolve => setTimeout(resolve, 12000)); // Wait 2 seconds between checks
      currentBlock = await provider.getBlockNumber();
      console.log(`[AggregatorService] Current block: ${currentBlock}, target: ${startBlock + targetBlocks}`);
    }
    
    console.log(`[AggregatorService] Waited ${currentBlock - startBlock} blocks for indexation`);
    notify.success("Ready", "Blockchain indexation complete", 12000);
  } catch (error) {
    console.warn("[AggregatorService] Error waiting for blocks:", error);
    // Continue anyway - this is just for better UX
  }
}

function computeDeadline(secondsFromNow = 900) {
  const nowSec = Math.floor(Date.now() / 1000);
  return BigInt(nowSec + Math.max(1, secondsFromNow));
}

// ======================= Read-only (UI) =======================
export async function readOwner() {
  const c = getContract(); if (!c) return ethers.ZeroAddress;
  return c.owner();
}

export async function readFeeBps() {
  const c = getContract(); if (!c) return 0;
  return c.feeBps();
}

export async function readFeeReceiver() {
  const c = getContract(); if (!c) return ethers.ZeroAddress;
  return c.feeReceiver();
}

export async function readWETH() {
  const c = getContract(); if (!c) return ethers.ZeroAddress;
  return c.WETH();
}

export async function readRouters() {
  const c = getContract(); if (!c) return [];
  return c.getRouters();
}

export async function readRouterCount() {
  const c = getContract(); if (!c) return 0n;
  const list = await c.getRouters();
  return BigInt(Array.isArray(list) ? list.length : 0);
}

export async function readRouterAt(index) {
  const c = getContract(); if (!c) return ethers.ZeroAddress;
  const list = await c.getRouters();
  const i = Number(index);
  if (!Array.isArray(list) || i < 0 || i >= list.length) return ethers.ZeroAddress;
  return list[i];
}

export async function readMaxFeeBps() {
  const c = getContract(); if (!c) return 0;
  return c.MAX_FEE_BPS();
}

export async function readMaxHops() {
  const c = getContract(); if (!c) return 0;
  return c.MAX_HOPS();
}

export async function readMaxIntermediate() {
  const c = getContract(); if (!c) return 0;
  return c.MAX_INTERMEDIATE();
}

export async function readMaxSlippageBps() {
  // MAX_SLIPPAGE_BPS doesn't exist in AggregatorMultiSplit; keeping for UI compat
  return 0;
}

// ======================= Quote (raw) =======================
export async function quote(amountIn, tokenIn, tokenOut, intermediates = []) {
  if (!amountIn || amountIn <= 0 || !ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
    throw new Error("[AggregatorService] Invalid input for quote");
  }
  const c = getContract();
  if (!c) return [0n, ethers.ZeroAddress, []];
  return c.quote(amountIn, tokenIn, tokenOut, intermediates);
}

export async function quoteBestRoute(
  amountIn,
  tokenIn,
  tokenOut,
  intermediates = []
) {
  if (!amountIn || amountIn <= 0 || !ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
    throw new Error("[AggregatorService] Invalid input for quoteBestRoute");
  }

  try {
    const contract = getContract();
    if (!contract) {
      // Safe return to not break UI when contract is not configured
      return { quotedOut: 0n, router: ethers.ZeroAddress, path: [], minOut: 0n, routeTokens: [] };
    }
    const [bestOut, routerAddr, path] = await contract.quote(
      amountIn,
      tokenIn,
      tokenOut,
      intermediates
    );
    // default slippage for UI (1%) if user doesn't configure
    const DEFAULT_SLIPPAGE_BPS = 100n;
    const minOut = bestOut > 0n ? (bestOut * (10000n - DEFAULT_SLIPPAGE_BPS)) / 10000n : 0n;
    const routeTokens = Array.isArray(path) ? path.map(addr => ({ address: addr })) : [];
    return {
      quotedOut: bestOut,
      router: routerAddr,
      path,
      minOut,
      routeTokens,
      slippage: 0n,
      fee: 0n,
      unitPrice: undefined,
    };
  } catch (err) {
    console.error("[AggregatorService] quoteBestRoute failed", {
      amountIn,
      tokenIn,
      tokenOut,
      intermediates,
      err,
    });
    throw err;
  }
}

export async function executeSwap({ signer, amountIn, tokenIn, tokenOut, intermediates = [], parts: userParts, deadline } = {}) {
  ensureSigner(signer);
  const contract = getContract(signer);
  if (!contract) throw new Error("[AggregatorService] Aggregator contract unavailable");
  const dl = deadline ?? computeDeadline();
  
  // Determines the number of parts based on configuration
  const cap = getMaxParts();
  const parts = Math.min(Math.max(1, Number(userParts || cap)), cap);
  
  // For ERC20 tokens, ensure allowance
  if (ethers.isAddress(tokenIn) && tokenIn !== ethers.ZeroAddress) {
    try {
      const owner = await signer.getAddress();
      
      // Check cache first
      const cachedSufficient = allowanceCache.isSufficient(owner, tokenIn, contract.target, amountIn);
      
      if (cachedSufficient === true) {
        console.log("[AggregatorService] Cache hit - approval sufficient, skipping blockchain call");
      } else {
        // Cache miss or insufficient - check blockchain
        const erc20 = new ethers.Contract(tokenIn, ERC20ABI, signer);
        const allowance = await erc20.allowance(owner, contract.target);
        
        // Cache the result
        allowanceCache.set(owner, tokenIn, contract.target, allowance);
        
        if (allowance < amountIn) {
          console.log("[AggregatorService] Approving token...");
          
          // Invalidate cache before approval
          allowanceCache.invalidate(owner, tokenIn, contract.target);
          
          const approveTx = await erc20.approve(contract.target, ethers.MaxUint256);
          await approveTx.wait();
          
          // Cache new max allowance with longer TTL
          const maxAllowanceTTL = 30 * 60 * 1000; // 30 minutes
          allowanceCache.set(owner, tokenIn, contract.target, ethers.MaxUint256, maxAllowanceTTL);
          
          console.log("[AggregatorService] Token approved and cached");
        }
      }
    } catch (approvalErr) {
      console.warn("[AggregatorService] Approval error:", approvalErr);
      
      // Invalidate cache on error
      const owner = await signer.getAddress().catch(() => null);
      if (owner) {
        allowanceCache.invalidate(owner, tokenIn, contract.target);
      }
      
      // Continue even with approval error - swap may fail but better to try
    }
  }
  
  // Execute multi-split swap
  const fn = contract.getFunction('swapMultiSplit');
  const overrides = getTxOverrides();
  
  console.log("[AggregatorService] Executing swap:", {
    amountIn: amountIn.toString(),
    tokenIn,
    tokenOut,
    intermediates,
    parts,
    deadline: dl.toString(),
    contractAddress: contract.target,
    overrides
  });
  
  try {
    const txReq = await fn.populateTransaction(amountIn, tokenIn, tokenOut, intermediates, parts, dl, overrides);
    console.log("[AggregatorService] Transaction populated:", {
      to: txReq.to,
      data: txReq.data,
      value: txReq.value?.toString() || "0",
      gasLimit: txReq.gasLimit?.toString()
    });
    
    const tx = await signer.sendTransaction(txReq);
    console.log("[AggregatorService] Transaction sent:", {
      hash: tx.hash,
      to: tx.to,
      value: tx.value?.toString() || "0"
    });
    
    return tx;
  } catch (txError) {
    console.error("[AggregatorService] Error sending transaction:", {
      message: txError?.message,
      reason: txError?.reason,
      code: txError?.code,
      data: txError?.data
    });
    throw txError;
  }
}

export async function getReserves(tokenA, tokenB, routerAddress) {
  try {
    const provider = getProvider();
    const factoryAbi = ["function getPair(address,address) view returns (address)"];
    const pairAbi = ["function getReserves() view returns (uint112,uint112,uint32)"];

    const router = new ethers.Contract(routerAddress, [
      "function factory() view returns (address)"
    ], provider);
    const factoryAddress = await router.factory();
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

    const pairAddress = await factory.getPair(tokenA, tokenB);
    if (!pairAddress || pairAddress === ethers.ZeroAddress) return null;

    const pair = new ethers.Contract(pairAddress, pairAbi, provider);
    const reserves = await pair.getReserves();
    return { reserve0: reserves[0], reserve1: reserves[1] };
  } catch (err) {
    console.error("[AggregatorService] getReserves failed", { tokenA, tokenB, routerAddress, err });
    return null;
  }
}

// Simple read-only check against a specific router for the current path
export async function getRouterAmountsOut(routerAddress, amountIn, path) {
  try {
    const provider = getProvider();
    if (!provider) throw new Error("[AggregatorService] provider indisponível");
    if (!ethers.isAddress(routerAddress)) throw new Error("[AggregatorService] router inválido");
    if (!Array.isArray(path) || path.length < 2) throw new Error("[AggregatorService] path inválido");
    const abi = [
      "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)"
    ];
    const router = new ethers.Contract(routerAddress, abi, provider);
    return await router.getAmountsOut(amountIn, path);
  } catch (err) {
    console.error("[AggregatorService] getRouterAmountsOut failed", { routerAddress, amountIn, path, err });
    throw err;
  }
}

// Swap execution with pre-calculated path and router (Token to Token)
export async function executeSwapWithPath({ signer, router, path, amountIn, minOut, parts: userParts, deadline } = {}) {
  ensureSigner(signer);
  if (!Array.isArray(path) || path.length < 2) throw new Error("[AggregatorService] invalid path");
  const contract = getContract(signer);
  if (!contract) throw new Error("[AggregatorService] Aggregator contract unavailable");
  const dl = deadline ?? computeDeadline();
  
  console.log("[AggregatorService] Executing Token -> Token swap");
  
  // Extract tokens from path
  const tokenIn = path[0];
  const tokenOut = path[path.length - 1];
  const intermediates = path.slice(1, -1);
  
  // 1. Ensure approval for tokenIn (must be ERC20)
  console.log("[AggregatorService] 1. Approving input token...");
  try {
    if (ethers.isAddress(tokenIn) && tokenIn !== ethers.ZeroAddress) {
      const owner = await signer.getAddress();
      
      // Check cache first
      const cachedSufficient = allowanceCache.isSufficient(owner, tokenIn, contract.target, amountIn);
      
      if (cachedSufficient === true) {
        console.log("[AggregatorService] Cache hit - approval sufficient for executeSwapWithPath");
      } else {
        // Cache miss or insufficient - check blockchain
        const erc20 = new ethers.Contract(tokenIn, ERC20ABI, signer);
        const allowance = await erc20.allowance(owner, contract.target);
        
        // Cache the result
        allowanceCache.set(owner, tokenIn, contract.target, allowance);
        
        if (allowance < amountIn) {
          console.log("[AggregatorService] Insufficient allowance, approving...");
          
          // Invalidate cache before approval
          allowanceCache.invalidate(owner, tokenIn, contract.target);
          
          const approveTx = await erc20.approve(contract.target, ethers.MaxUint256);
          await approveTx.wait();
          
          // Cache new max allowance with longer TTL
          const maxAllowanceTTL = 30 * 60 * 1000; // 30 minutes
          allowanceCache.set(owner, tokenIn, contract.target, ethers.MaxUint256, maxAllowanceTTL);
          
          console.log("[AggregatorService] Token approved and cached");
        }
      }
    }
  } catch (approvalErr) {
    console.warn("[AggregatorService] Approval error:", approvalErr);
    
    // Invalidate cache on error
    const owner = await signer.getAddress().catch(() => null);
    if (owner) {
      allowanceCache.invalidate(owner, tokenIn, contract.target);
    }
  }
  
  // 2. Execute multi-split swap
  console.log("[AggregatorService] 2. Executing multi-split swap...");
  const cap = getMaxParts();
  const parts = Math.min(Math.max(1, Number(userParts || cap)), cap);
  
  const fn = contract.getFunction('swapMultiSplit');
  
  console.log("[AggregatorService] Swap parameters:", {
    amountIn: amountIn.toString(),
    tokenIn,
    tokenOut,
    intermediates,
    parts,
    deadline: dl.toString(),
    contractAddress: contract.target
  });
  
  try {
    const txReq = await fn.populateTransaction(amountIn, tokenIn, tokenOut, intermediates, parts, dl, getTxOverrides());
    console.log("[AggregatorService] Transaction populated:", {
      to: txReq.to,
      data: txReq.data,
      value: txReq.value?.toString() || "0",
      gasLimit: txReq.gasLimit?.toString()
    });
    
    const swapTx = await signer.sendTransaction(txReq);
    console.log("[AggregatorService] Swap sent:", {
      hash: swapTx.hash,
      to: swapTx.to,
      value: swapTx.value?.toString() || "0"
    });
    
    const receipt = await swapTx.wait();
    console.log("[AggregatorService] Swap confirmed:", {
      transactionHash: receipt.transactionHash,
      status: receipt.status,
      gasUsed: receipt.gasUsed?.toString()
    });
    
    // Wait for blockchain indexation
    await waitForBlocks(signer.provider, 3);
    
    console.log("[AggregatorService] Token -> Token swap executed successfully");
    return swapTx;
  } catch (swapError) {
    console.error("[AggregatorService] Swap error:", {
      message: swapError?.message,
      reason: swapError?.reason,
      code: swapError?.code,
      data: swapError?.data
    });
    throw swapError;
  }
}

export async function executeSwapWithSlippage({ signer, amountIn, tokenIn, tokenOut, intermediates = [], userMaxSlippageBps, parts: userParts, deadline } = {}) {
  ensureSigner(signer);
  const contract = getContract(signer);
  if (!contract) throw new Error("[AggregatorService] Aggregator contract unavailable");
  const dl = deadline ?? computeDeadline();
  // No swapWithSlippage available; using swapMultiSplit
  const cap = getMaxParts();
  const parts = Math.min(Math.max(1, Number(userParts || cap)), cap);
  const fn = contract.getFunction('swapMultiSplit');
  const txReq = await fn.populateTransaction(amountIn, tokenIn, tokenOut, intermediates, parts, dl, getTxOverrides());
  return signer.sendTransaction(txReq);
}

export async function executeSwapETHForToken({ signer, router, path, minOut, amountInWei, parts: userParts, deadline } = {}) {
  ensureSigner(signer);
  if (!Array.isArray(path) || path.length < 2) throw new Error("[AggregatorService] invalid path");
  const contract = getContract(signer);
  if (!contract) throw new Error("[AggregatorService] Aggregator contract unavailable");
  const dl = deadline ?? computeDeadline();
  
  // For native swaps (ONE -> Token), AggregatorMultiSplit contract doesn't accept ETH directly
  // We need to do: ONE -> WONE -> swap
  const woneAddress = path[0]; // First token in path should be WONE
  const IWETH_ABI = [
    "function deposit() payable",
    "function withdraw(uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ];
  
  const w = new ethers.Contract(woneAddress, IWETH_ABI, signer);
  const erc20 = new ethers.Contract(woneAddress, ERC20ABI, signer);
  const owner = await signer.getAddress();
  const aggAddr = contract.target;
  
  console.log("[AggregatorService] Executing native ONE -> Token swap");
  notify.info("Wrapping", "Converting ONE to WONE...", 12000);
  console.log("[AggregatorService] 1. Converting ONE to WONE...");
  
  // 1. Deposit ONE → WONE
  const depositOverrides = { ...getTxOverrides(), value: amountInWei };
  const depTx = await w.deposit(depositOverrides);
  await depTx.wait();
  notify.success("Wrapped", "ONE converted to WONE", 12000);
  console.log("[AggregatorService] ONE converted to WONE");
  
  // 2. Approve aggregator to spend WONE
  notify.info("Approving", "Approving WONE for swap...", 12000);
  console.log("[AggregatorService] 2. Approving WONE for aggregator...");
  const approveTx = await erc20.approve(aggAddr, ethers.MaxUint256);
  await approveTx.wait();
  notify.success("Approved", "WONE approved for swap", 12000);
  console.log("[AggregatorService] WONE approved");
  
  // 3. Execute multi-split swap
  notify.info("Swapping", "Executing multi-split swap...", 13000);
  console.log("[AggregatorService] 3. Executing multi-split swap...");
  const tokenIn = path[0]; // WONE
  const tokenOut = path[path.length - 1];
  const intermediates = path.slice(1, -1);
  const cap = getMaxParts();
  const parts = Math.min(Math.max(1, Number(userParts || cap)), cap);
  
  const fn = contract.getFunction('swapMultiSplit');
  
  console.log("[AggregatorService] Swap parameters:", {
    amountInWei: amountInWei.toString(),
    tokenIn,
    tokenOut,
    intermediates,
    parts,
    deadline: dl.toString(),
    contractAddress: contract.target
  });
  
  try {
    const txReq = await fn.populateTransaction(amountInWei, tokenIn, tokenOut, intermediates, parts, dl, getTxOverrides());
    console.log("[AggregatorService] Transaction populated:", {
      to: txReq.to,
      data: txReq.data,
      value: txReq.value?.toString() || "0",
      gasLimit: txReq.gasLimit?.toString()
    });
    
    const swapTx = await signer.sendTransaction(txReq);
    console.log("[AggregatorService] Swap sent:", {
      hash: swapTx.hash,
      to: swapTx.to,
      value: swapTx.value?.toString() || "0"
    });
    
    const receipt = await swapTx.wait();
    console.log("[AggregatorService] Swap confirmed:", {
      transactionHash: receipt.transactionHash,
      status: receipt.status,
      gasUsed: receipt.gasUsed?.toString()
    });
    
    // Wait for blockchain indexation
    await waitForBlocks(signer.provider, 3);
    
    console.log("[AggregatorService] Swap executed successfully");
    return swapTx;
  } catch (swapError) {
    console.error("[AggregatorService] Swap error:", {
      message: swapError?.message,
      reason: swapError?.reason,
      code: swapError?.code,
      data: swapError?.data
    });
    throw swapError;
  }
}

export async function executeSwapTokenForETH({ signer, router, path, amountIn, minOut, parts: userParts, deadline } = {}) {
  ensureSigner(signer);
  if (!Array.isArray(path) || path.length < 2) throw new Error("[AggregatorService] invalid path");
  const contract = getContract(signer);
  if (!contract) throw new Error("[AggregatorService] Aggregator contract unavailable");
  const dl = deadline ?? computeDeadline();
  
  console.log("[AggregatorService] Executing Token -> native ONE swap");
  
  // 1. Ensure approval for input token
  console.log("[AggregatorService] 1. Approving input token...");
  try {
    const owner = await signer.getAddress();
    const tokenIn = path[0];
    
    // Check cache first
    const cachedSufficient = allowanceCache.isSufficient(owner, tokenIn, contract.target, amountIn);
    
    if (cachedSufficient === true) {
      console.log("[AggregatorService] Cache hit - approval sufficient for executeSwapTokenForETH");
    } else {
      // Cache miss or insufficient - check blockchain
      const erc20 = new ethers.Contract(tokenIn, ERC20ABI, signer);
      const allowance = await erc20.allowance(owner, contract.target);
      
      // Cache the result
      allowanceCache.set(owner, tokenIn, contract.target, allowance);
      
      if (allowance < amountIn) {
        console.log("[AggregatorService] Insufficient allowance, approving...");
        
        // Invalidate cache before approval
        allowanceCache.invalidate(owner, tokenIn, contract.target);
        
        const approveTx = await erc20.approve(contract.target, ethers.MaxUint256);
        await approveTx.wait();
        
        // Cache new max allowance with longer TTL
        const maxAllowanceTTL = 30 * 60 * 1000; // 30 minutes
        allowanceCache.set(owner, tokenIn, contract.target, ethers.MaxUint256, maxAllowanceTTL);
        
        console.log("[AggregatorService] Token approved and cached");
      }
    }
  } catch (approvalErr) {
    console.warn("[AggregatorService] Approval error:", approvalErr);
    
    // Invalidate cache on error
    const owner = await signer.getAddress().catch(() => null);
    if (owner) {
      allowanceCache.invalidate(owner, path[0], contract.target);
    }
  }
  
  // 2. Check WONE balance before swap
  const woneAddress = path[path.length - 1]; // Last token in path should be WONE
  const IWETH_ABI = [
    "function deposit() payable",
    "function withdraw(uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ];
  const w = new ethers.Contract(woneAddress, IWETH_ABI, signer);
  const me = await signer.getAddress();
  const balanceBefore = await w.balanceOf(me);
  
  // 3. Execute swap
  notify.info("Swapping", "Executing Token -> WONE swap...", 13000);
  console.log("[AggregatorService] 2. Executing swap...");
  const tokenIn = path[0];
  const tokenOut = path[path.length - 1]; // WONE
  const intermediates = path.slice(1, -1);
  const cap = getMaxParts();
  const parts = Math.min(Math.max(1, Number(userParts || cap)), cap);
  
  const fn = contract.getFunction('swapMultiSplit');
  
  let swapTx; // Declare outside try/catch
  
  console.log("[AggregatorService] Swap parameters:", {
    amountIn: amountIn.toString(),
    tokenIn,
    tokenOut,
    intermediates,
    parts,
    deadline: dl.toString(),
    contractAddress: contract.target
  });
  
  try {
    const txReq = await fn.populateTransaction(amountIn, tokenIn, tokenOut, intermediates, parts, dl, getTxOverrides());
    console.log("[AggregatorService] Transaction populated:", {
      to: txReq.to,
      data: txReq.data,
      value: txReq.value?.toString() || "0",
      gasLimit: txReq.gasLimit?.toString()
    });
    
    swapTx = await signer.sendTransaction(txReq);
    console.log("[AggregatorService] Swap sent:", {
      hash: swapTx.hash,
      to: swapTx.to,
      value: swapTx.value?.toString() || "0"
    });
    
    const receipt = await swapTx.wait();
    console.log("[AggregatorService] Swap confirmed:", {
      transactionHash: receipt.transactionHash,
      status: receipt.status,
      gasUsed: receipt.gasUsed?.toString()
    });
    
    // Wait for blockchain indexation
    await waitForBlocks(signer.provider, 3);
  } catch (swapError) {
    console.error("[AggregatorService] Swap error:", {
      message: swapError?.message,
      reason: swapError?.reason,
      code: swapError?.code,
      data: swapError?.data
    });
    throw swapError;
  }
  
  // 4. Unwrap received WONE to native ONE
  notify.info("Unwrapping", "Converting WONE to ONE...", 12000);
  console.log("[AggregatorService] 3. Converting WONE to ONE...");
  const balanceAfter = await w.balanceOf(me);
  const delta = balanceAfter - balanceBefore;
  
  console.log("[AggregatorService] WONE balances:", {
    before: balanceBefore.toString(),
    after: balanceAfter.toString(),
    delta: delta.toString()
  });
  
  if (delta > 0n) {
    try {
      const withdrawTx = await w.withdraw(delta, getTxOverrides());
      console.log("[AggregatorService] Withdraw sent:", withdrawTx.hash);
      
      const withdrawReceipt = await withdrawTx.wait();
      notify.success("Unwrapped", "WONE converted to native ONE", 12000);
      console.log("[AggregatorService] Withdraw confirmed:", {
        transactionHash: withdrawReceipt.transactionHash,
        status: withdrawReceipt.status
      });
      
      console.log("[AggregatorService] WONE converted to native ONE");
    } catch (withdrawError) {
      console.error("[AggregatorService] Withdraw error:", {
        message: withdrawError?.message,
        reason: withdrawError?.reason
      });
      // Don't re-throw error to not break the swap that already happened
    }
  } else {
    console.warn("[AggregatorService] No WONE received to convert");
  }
  
  return swapTx;
}

// Admin
export async function adminAddRouter({ signer, router }) {
  ensureSigner(signer);
  if (!ethers.isAddress(router)) throw new Error("[AggregatorService] invalid router");
  const c = getContract(signer);
  if (!c) throw new Error("[AggregatorService] Aggregator contract unavailable");
  return c.addRouter(router);
}

export async function adminRemoveRouter({ signer, router }) {
  ensureSigner(signer);
  if (!ethers.isAddress(router)) throw new Error("[AggregatorService] invalid router");
  const c = getContract(signer);
  if (!c) throw new Error("[AggregatorService] Aggregator contract unavailable");
  return c.removeRouter(router);
}

export async function adminSetFeeBps({ signer, newFeeBps }) {
  ensureSigner(signer);
  const c = getContract(signer);
  if (!c) throw new Error("[AggregatorService] Aggregator contract unavailable");
  return c.setFeeBps(newFeeBps);
}

export async function adminSetFeeReceiver({ signer, newReceiver }) {
  ensureSigner(signer);
  if (!ethers.isAddress(newReceiver)) throw new Error("[AggregatorService] invalid receiver address");
  const c = getContract(signer);
  if (!c) throw new Error("[AggregatorService] Aggregator contract unavailable");
  return c.setFeeReceiver(newReceiver);
}

export async function adminSetWETH({ signer, wethAddress }) {
  ensureSigner(signer);
  if (!ethers.isAddress(wethAddress)) throw new Error("[AggregatorService] invalid WETH");
  const c = getContract(signer);
  if (!c) throw new Error("[AggregatorService] Aggregator contract unavailable");
  return c.setWETH(wethAddress);
}

export async function adminTransferOwnership({ signer, newOwner }) {
  ensureSigner(signer);
  if (!ethers.isAddress(newOwner)) throw new Error("[AggregatorService] invalid new owner");
  const c = getContract(signer);
  if (!c) throw new Error("[AggregatorService] Aggregator contract unavailable");
  return c.transferOwnership(newOwner);
}

export async function adminRenounceOwnership({ signer }) {
  ensureSigner(signer);
  const c = getContract(signer);
  if (!c) throw new Error("[AggregatorService] Aggregator contract unavailable");
  return c.renounceOwnership();
}
