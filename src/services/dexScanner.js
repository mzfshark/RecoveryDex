// src/services/dexScanner.js
import { ethers, formatUnits } from "ethers";

const FACTORY_ABI = [
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)"
];

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)"
];

export async function fetchLiquidity(providerUrl, targetTokens, factoryAddresses) {
  const provider = new ethers.JsonRpcProvider(providerUrl);
  const result = {};

  for (const token of targetTokens) {
    result[token.symbol] = { total: 0, pairs: 0 };
  }

  for (const dex of factoryAddresses) {
    const factory = new ethers.Contract(dex.address, FACTORY_ABI, provider);
    const totalPairs = await factory.allPairsLength();

    for (let i = 0; i < totalPairs; i++) {
      const pairAddress = await factory.allPairs(i);
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);

      const [token0, token1] = await Promise.all([pair.token0(), pair.token1()]);

      const matchToken = targetTokens.find(t =>
        t.address.toLowerCase() === token0.toLowerCase() ||
        t.address.toLowerCase() === token1.toLowerCase()
      );

      if (matchToken) {
        const [reserve0, reserve1] = await pair.getReserves();
        const isToken0 = matchToken.address.toLowerCase() === token0.toLowerCase();
        const amount = isToken0 ? reserve0 : reserve1;

        result[matchToken.symbol].total += Number(formatUnits(amount, matchToken.decimals));
        result[matchToken.symbol].pairs += 1;
      }
    }
  }

  return result;
}
