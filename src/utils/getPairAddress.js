//src/utils/getPairAddress.js
import { ethers, keccak256, getAddress, zeroPadValue } from "ethers";

import UniswapV2FactoryABI from "../abis/IUniswapV2Factory.json";
import routers from "../config/routers.json";

/**
 * Sorts two token addresses the same way Uniswap V2 does.
 * @param {string} tokenA
 * @param {string} tokenB
 * @returns {[string,string]} [token0, token1] sorted lexicographically
 */
function sortTokens(tokenA, tokenB) {
  const [addrA, addrB] = [getAddress(tokenA), getAddress(tokenB)];
  return addrA.toLowerCase() < addrB.toLowerCase()
    ? [addrA, addrB]
    : [addrB, addrA];
}

/**
 * Deterministic calculation of a pair address (CREATE2) in case factory.getPair()
 * returns 0x… (alguns forks não expõem getPair ou retornam 0).
 *
 * pair = address(
 *   uint160(                      // downcast to match the address type
 *     uint256(                    // convert to uint to truncate to uint160
 *       keccak256(                // compute CREATE2 hash
 *         0xff ++ factory ++ salt ++ init_code_hash
 *       )
 *     )
 *   )
 * )
 *
 * salt = keccak256(token0 ++ token1)
 * @param {string} factory
 * @param {string} tokenA
 * @param {string} tokenB
 * @param {string} initCodeHash
 * @returns {string} computed pair address
 */
function computePairAddress(factory, tokenA, tokenB, initCodeHash) {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const salt = keccak256(
    ethers.concat([zeroPadValue(token0, 32), zeroPadValue(token1, 32)])
  );
  const packed = ethers.concat([
    "0xff",
    factory,
    salt,
    initCodeHash,
  ]);
  // last 20 bytes of the hash
  return getAddress(`0x${keccak256(packed).slice(-40)}`);
}

/**
 * Main helper that returns a valid pair address for tokenA-tokenB
 *   1. Tenta factory.getPair(tokenA, tokenB)
 *   2. Se falhar (ou retornar 0x0) calcula via CREATE2 (caso você tenha o initCodeHash)
 *
 * @param {string} tokenA endereço tokenA
 * @param {string} tokenB endereço tokenB
 * @param {ethers.Provider} provider ethers provider
 * @param {string} routerFriendly router name (ex. "Sushiswap") — será mapeado via routers.json
 * @returns {Promise<string>} endereço do par (lança erro se não encontrar)
 */
export async function getPairAddress(tokenA, tokenB, provider, routerFriendly) {
  if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) {
    throw new Error("Invalid token address");
  }

  // 1. encontre factory & init code hash via routers.json
  const routerConfig =
    routers?.UNISWAP?.FACTORY?.[routerFriendly] ||
    routers?.UNISWAP?.FACTORY?.[routerFriendly?.toUpperCase?.()] ||
    null;

  if (!routerConfig) {
    throw new Error(`Factory for router "${routerFriendly}" not found in routers.json`);
  }

  const factoryAddress = routerConfig;
  const initCodeHash = routerConfig?.initCodeHash; // optional
  if (!ethers.isAddress(factoryAddress)) {
    throw new Error("Invalid factory address in routers.json");
  }

  const factoryContract = new ethers.Contract(
    factoryAddress,
    UniswapV2FactoryABI,
    provider
  );

  // 2. tente chamada getPair
  let pair = ethers.ZeroAddress;
  try {
    pair = await factoryContract.getPair(tokenA, tokenB);
  } catch {
    /* silencioso — forks antigos podem não ter getPair() público */
  }

  // 3. se factory não retornou, calcule deterministicamente
  if (pair === ethers.ZeroAddress && initCodeHash) {
    pair = computePairAddress(factoryAddress, tokenA, tokenB, initCodeHash);
  }

  // 4. verifique se existe byte-code no endereço
  const code = await provider.getCode(pair);
  if (code === "0x") {
    throw new Error(`No contract found at pair address ${pair}`);
  }

  return pair;
}
