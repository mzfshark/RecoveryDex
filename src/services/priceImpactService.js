// src/services/priceImpactService.js
import { ethers } from "ethers";
import { getReserves } from "./aggregatorService";
import tokenList from "../lists/harmony-tokenlist.json";
import { WONE_ADDRESS, CONTRACT_FEE_PCT } from "../utils/constants";

// Extract token array
const TOKENS = Array.isArray(tokenList)
  ? tokenList
  : tokenList.tokens || [];

/**
 * Calculates total price impact (%) and fixed fee (%) for a given swap path.
 * @param {string[]} path - Array of token addresses for the swap (e.g. [tokenIn, tokenMid, tokenOut]).
 * @param {bigint} amountInRaw - The input amount as a BigInt (parsedUnits).
 * @returns {{ slippage: number, fee: number }}
 */
export async function calculatePriceImpact(path, amountInRaw, routerAddress) {
  let totalSlip = 0;

  if (!Array.isArray(path) || path.length < 2) {
    return { slippage: 0, fee: CONTRACT_FEE_PCT };
  }

  // Normalize token addresses for lookups (native -> WONE)
  const normalizedPath = path.map(addr => {
    if (!addr || addr === 'native') return WONE_ADDRESS;
    return addr;
  });

  // Determine input token decimals (handle WONE explicitly)
  const firstAddr = normalizedPath[0]?.toLowerCase();
  const inTokenMeta = firstAddr === WONE_ADDRESS.toLowerCase()
    ? { decimals: 18 }
    : TOKENS.find((t) => t.address.toLowerCase() === firstAddr);
  const inDecimals = inTokenMeta?.decimals ?? 18;

  // Convert input amount to decimal number
  const amountIn = Number(ethers.formatUnits(amountInRaw, inDecimals));
  if (isNaN(amountIn) || amountIn <= 0) {
    return { slippage: 0, fee: CONTRACT_FEE_PCT };
  }

  // Iterate each hop and approximate using reserve of tokenIn side
  let successfulHops = 0;
  for (let i = 0; i < normalizedPath.length - 1; i++) {
    const tokenA = normalizedPath[i].toLowerCase();
    const tokenB = normalizedPath[i + 1].toLowerCase();

    const metaA = tokenA === WONE_ADDRESS.toLowerCase()
      ? { decimals: 18 }
      : TOKENS.find((t) => t.address.toLowerCase() === tokenA);
    const decA = metaA?.decimals ?? 18;

    try {
      const reserves = await getReserves(tokenA, tokenB, routerAddress);
      if (!reserves || reserves.reserve0 === undefined || reserves.reserve1 === undefined) {
        // If we can't fetch reserves, skip this hop contribution but continue
        continue;
      }
      // UniswapV2 sorts token0 < token1 by address
      const token0 = tokenA < tokenB ? tokenA : tokenB;
      const isA0 = tokenA === token0;
      const rA = isA0 ? reserves.reserve0 : reserves.reserve1;
      const reserveA = Number(ethers.formatUnits(rA, decA));

      if (reserveA > 0) {
        const slip = (amountIn / (reserveA + amountIn)) * 100;
        totalSlip += slip;
        successfulHops++;
      }
    } catch (err) {
      // On any error fetching reserves, skip this hop but don't fail entirely
      console.warn(`[priceImpact] Failed to get reserves for ${tokenA}-${tokenB}:`, err.message);
      continue;
    }
  }

  // If no hops were successful, provide a conservative fallback estimate
  if (successfulHops === 0) {
    // Fallback: estimate based on amount size (larger amounts have more impact)
    const amountFloat = Number(amountIn);
    const conservativeImpact = Math.min(amountFloat * 0.1, 5); // Cap at 5%
    totalSlip = conservativeImpact;
  }

  // Fee is always the fixed contract fee (0.25%), not derived from slippage
  return { slippage: totalSlip, fee: CONTRACT_FEE_PCT };
}
