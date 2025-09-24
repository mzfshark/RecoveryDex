// src/utils/getFactoryCodeHash.js
import { ethers } from "ethers";

// Minimal ABI for a factory contract that has a `pairCodeHash()` function.
const ABI = [
  "function pairCodeHash() external pure returns (bytes32)"
];

/**
 * Fetches the factory's pair code hash dynamically by calling its pairCodeHash() function.
 * @param {string} factoryAddress - The address of the factory contract.
 * @param {ethers.Provider} provider - An ethers provider.
 * @returns {Promise<string>} The init code hash (as a hex string).
 */
export async function getFactoryCodeHash(factoryAddress, provider) {
  try {
    const factoryContract = new ethers.Contract(factoryAddress, ABI, provider);
    const codeHash = await factoryContract.pairCodeHash();
    return codeHash;
  } catch (err) {
    console.error("Error fetching factory code hash:", err);
    throw err;
  }
}
