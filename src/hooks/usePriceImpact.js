// src/hooks/usePriceImpact.js
import { useMemo } from "react";
import { parseUnits } from "ethers";

export const usePriceImpact = (idealOut, actualOut, outputDecimals, slippage = 1) => {
  return useMemo(() => {
    if (!idealOut || !actualOut || idealOut === 0n) {
      return {
        priceImpactPct: 0,
        feePct: 0,
        minAmountOut: parseUnits("0", outputDecimals || 18),
      };
    }

    const priceImpactPct = Number(((idealOut - actualOut) * 10000n) / idealOut) / 100; // em %
    const feePct = priceImpactPct * 0.01; // 1% do impacto como fee
    const effectiveSlippage = slippage + feePct;

    const minOutPct = (100 - effectiveSlippage) / 100;

    const minAmountOut = actualOut * BigInt(Math.floor(minOutPct * 10000)) / 10000n;

    return {
      priceImpactPct,
      feePct,
      minAmountOut,
    };
  }, [idealOut, actualOut, outputDecimals, slippage]);
};
