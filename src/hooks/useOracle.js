// src/hooks/useOracle.js
import { useEffect, useState } from "react";
import { fetchOraclePrice } from "../utils/fetchOraclePrice";

export const useOracle = (provider, tokenSymbol) => {
  const [oraclePrice, setOraclePrice] = useState("N/A");

  useEffect(() => {
    const updateOraclePrice = async () => {
      if (provider && tokenSymbol.toUpperCase() === "ONE") {
        const priceFromOracle = await fetchOraclePrice(provider, tokenSymbol, "USDC");
        if (priceFromOracle !== null) {
          setOraclePrice(priceFromOracle.toString());
        } else {
          setOraclePrice("N/A");
        }
      } else {
        setOraclePrice("N/A");
      }
    };

    updateOraclePrice();
  }, [provider, tokenSymbol]);

  return oraclePrice;
};