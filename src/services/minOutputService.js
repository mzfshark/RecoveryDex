// src/services/minOutputService.js

/**
 * Calculates the minimum output amount accounting for slippage and fee.
 * @param {number} amountOut - The raw output amount in decimal units (e.g., 1.234).
 * @param {number} slippagePct - The price impact percentage (e.g., 0.5 for 0.5%).
 * @param {number} feePct - The fee percentage (e.g., 0.01 for 0.01%).
 * @returns {number} - The minimum acceptable output amount.
 */
export function calculateMinOutput(amountOut, slippagePct, feePct) {
  const combinedPct = slippagePct + feePct;
  const factor = 1 - combinedPct / 100;
  return amountOut * factor;
}
