// src/utils/fetchPoolReserves.jsx
import { ethers } from "ethers";
import { getFactoryCodeHash } from "./getFactoryCodeHash";
import factoryData from "../factory.json";

/**
 * Sort tokens lexicographically.
 * @param {string} tokenA
 * @param {string} tokenB
 * @returns {Array} Sorted array [token0, token1]
 */
function sortTokens(tokenA, tokenB) {
  return tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
}

/**
 * Computes the CREATE2 address for a pair contract.
 * @param {string} factoryAddress - The factory address.
 * @param {Array} tokens - An array with two sorted token addresses [token0, token1].
 * @param {string} initCodeHash - The init code hash.
 * @returns {string} - The computed pair address.
 */
function computePairAddress(factoryAddress, tokens, initCodeHash) {
  // Use ethers.keccak256 and ethers.solidityPacked from the top-level package.
  const salt = ethers.keccak256(ethers.solidityPacked(["address", "address"], tokens));
  return ethers.getCreate2Address(factoryAddress, salt, initCodeHash);
}

/**
 * Fetches the pool reserves for a given token pair.
 *
 * @param {string} tokenAAddress - Address of token A.
 * @param {string} tokenBAddress - Address of token B.
 * @param {ethers.Provider} provider - An ethers provider.
 * @param {string} routerName - Friendly name of the router (e.g., "VIPERSWAP").
 * @returns {Promise<Object>} - An object with properties poolInputReserve and poolOutputReserve as BigInt.
 */
export async function fetchPoolReserves(tokenAAddress, tokenBAddress, provider, routerName) {
  // Look up factory address for the given routerName from factoryData.
  const factoryAddress = factoryData?.UNISWAP?.FACTORY?.[routerName.toUpperCase()];


  if (!factoryAddress) {
    throw new Error(`Factory address not found for router "${routerName}"`);
  }

  // Get the init code hash dynamically from the factory contract.
  const initCodeHash = await getFactoryCodeHash(factoryAddress, provider);

  // Sort token addresses to match pair creation order.
  const [token0, token1] = sortTokens(tokenAAddress, tokenBAddress);
  let pairAddress;
  try {
    pairAddress = computePairAddress(factoryAddress, [token0, token1], initCodeHash);
  } catch (error) {
    console.error("Error computing pair address:", error);
    console.log("Computed pair address:", pairAddress);
    throw error;
  }

  // Minimal ABI for a Uniswap V2 pair contract's getReserves method.
  const UniswapV2PairABI = [
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
  ];

  try {
    const pairContract = new ethers.Contract(pairAddress, UniswapV2PairABI, provider);
    const reserves = await pairContract.getReserves();
    // Determine which reserve corresponds to tokenAAddress.
    if (tokenAAddress.toLowerCase() === token0.toLowerCase()) {
      return {
        poolInputReserve: reserves.reserve0,
        poolOutputReserve: reserves.reserve1,
      };
    } else {
      return {
        poolInputReserve: reserves.reserve1,
        poolOutputReserve: reserves.reserve0,
      };
    }
  } catch (err) {
    console.error("Error fetching pool reserves:", err);
    throw err;
  }
}
