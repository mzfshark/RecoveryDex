import { ethers } from "ethers";

/**
 * Calculates the conversion rate between two tokens.
 *
 * If pool reserves are provided, the function uses these reserves to determine the
 * token price from the pool data. Otherwise, it falls back to the aggregated amount
 * values (inputAmount and outputAmount) for price calculation.
 *
 * @param {bigint} inputAmount - The input token amount (BigInt, in wei units).
 * @param {bigint} outputAmount - The expected output amount (BigInt) from the aggregator.
 * @param {number} inputDecimals - Number of decimals for the input token (default: 18).
 * @param {number} outputDecimals - Number of decimals for the output token (default: 18).
 * @param {number} precision - Number of decimal places to display in the result (default: 6).
 * @param {bigint} [poolInputReserve] - (Optional) The reserve amount for the input token in the pool.
 * @param {bigint} [poolOutputReserve] - (Optional) The reserve amount for the output token in the pool.
 * @returns {string} - The calculated price as a string.
 */
export const getTokenPrice = (
  inputAmount,
  outputAmount,
  inputDecimals = 18,
  outputDecimals = 18,
  precision = 6,
  poolInputReserve,
  poolOutputReserve
) => {
  try {
    // If pool reserves are provided and valid, calculate the pool-based price.
    if (
      poolInputReserve !== undefined &&
      poolOutputReserve !== undefined &&
      poolInputReserve !== 0n
    ) {
      const inputFormatted = Number(ethers.formatUnits(poolInputReserve, inputDecimals));
      const outputFormatted = Number(ethers.formatUnits(poolOutputReserve, outputDecimals));
      const rate = outputFormatted / inputFormatted;
      return rate.toFixed(precision);
    } else {
      // Fallback: Calculate price from aggregator values.
      if (!inputAmount || !outputAmount || inputAmount === 0n) return "0";
      const inputFormatted = Number(ethers.formatUnits(inputAmount, inputDecimals));
      const outputFormatted = Number(ethers.formatUnits(outputAmount, outputDecimals));
      const rate = outputFormatted / inputFormatted;
      return rate.toFixed(precision);
    }
  } catch (err) {
    console.error("Error calculating token price:", err);
    return "0";
  }
};

