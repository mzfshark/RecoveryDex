// src/utils/fetchOraclePrice.jsx
import { Contract } from "ethers";
import BandOracleABI from "../abis/BandOracleAggregator.json";

const ORACLE_ADDRESS = import.meta.env.VITE_BAND_ADDRESS || "0x0A87139b65399102f5F9B9B245531CF1A04ec86d";

export async function fetchOraclePrice(provider, baseSymbol, quoteSymbol = "USDC") {
  let adjustedBase, adjustedQuote, result;
  try {
    adjustedBase = baseSymbol.toUpperCase();
    adjustedQuote = quoteSymbol.toUpperCase();

    const oracle = new Contract(ORACLE_ADDRESS, BandOracleABI, provider);
    result = await oracle.getReferenceData(adjustedBase, adjustedQuote);

    const price = Number(result.rate) / 1e18;
    return price;
  } catch (err) {
    console.error(`Error fetching oracle price for ${baseSymbol}/${quoteSymbol}:`, err);
    console.log(`Fetching oracle price for ${adjustedBase}/${adjustedQuote}`);
    console.log("Oracle result:", result);
    return null;
  }
}
