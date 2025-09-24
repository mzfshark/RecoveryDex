// src/utils/fetchPoolPrice.js
import { ethers, formatUnits } from "ethers";
import { FACTORY_ADDRESSES } from "../constants/dexFatories";

const FACTORY_ABI = [
  "function getPair(address,address) view returns (address)"
];

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)"
];

// Cache em memória para reduzir jitter entre re-renderizações curtas
const PRICE_CACHE = new Map(); // key: `${chainId||0}:${base}:${quote}` -> { price, ts }
const CACHE_TTL_MS = 15_000; // 15s

// Helper: best pair price between base and quote across factories (maximizes quote liquidity)
async function getBestPairPrice(provider, base, quote, baseDecimals, quoteDecimals) {
  let best = null; // { price, quoteReserve }

  for (const dex of FACTORY_ADDRESSES) {
    try {
      const factory = new ethers.Contract(dex.address, FACTORY_ABI, provider);
      const pairAddress = await factory.getPair(base, quote);
      if (!pairAddress || pairAddress === ethers.ZeroAddress) continue;

      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [t0, t1] = await Promise.all([pair.token0(), pair.token1()]);
      const [r0, r1] = await pair.getReserves();

      let price, quoteReserveNorm;
      if (t0.toLowerCase() === base.toLowerCase() && t1.toLowerCase() === quote.toLowerCase()) {
        // price = quote/base
        const baseReserve = Number(formatUnits(r0, baseDecimals));
        const quoteReserve = Number(formatUnits(r1, quoteDecimals));
        if (baseReserve > 0) {
          price = quoteReserve / baseReserve;
          quoteReserveNorm = quoteReserve;
        }
      } else if (t1.toLowerCase() === base.toLowerCase() && t0.toLowerCase() === quote.toLowerCase()) {
        const baseReserve = Number(formatUnits(r1, baseDecimals));
        const quoteReserve = Number(formatUnits(r0, quoteDecimals));
        if (baseReserve > 0) {
          price = quoteReserve / baseReserve;
          quoteReserveNorm = quoteReserve;
        }
      }

      // Proteger contra ruído: exigir liquidez mínima em quote para aceitar
      if (price && (quoteReserveNorm ?? 0) > 100) {
        if (best === null || (quoteReserveNorm ?? 0) > best.quoteReserve) {
        best = { price, quoteReserve: quoteReserveNorm ?? 0 };
        }
      }
    } catch {
      // ignore individual factory errors
    }
  }

  return best?.price ?? null;
}

// Main: fetch USD price for base using stables or WONE route.
export async function fetchPoolUsdPrice(provider, baseToken, tokenList) {
  if (!provider || !baseToken?.address) return null;

  const baseAddr = baseToken.address;
  const baseDec = Number(baseToken.decimals ?? 18);
  let chainId = 0;
  try { chainId = (await provider.getNetwork())?.chainId ?? 0; } catch {}

  // candidates: stables by common symbols
  const STABLE_SYMBOLS = new Set(["USDC", "USDT", "BUSD", "DAI", "BSCBUSD"]);

  const findBySymbol = (sym) => tokenList?.find?.(t => (t.symbol || "").toUpperCase() === sym);
  const stables = (tokenList || [])
    .filter(t => STABLE_SYMBOLS.has((t.symbol || "").toUpperCase()))
    .map(t => ({ address: t.address, decimals: Number(t.decimals ?? 18), symbol: t.symbol }));

  // Try cache first
  const cacheKey = `${chainId}:${baseAddr}:USD`;
  const hit = PRICE_CACHE.get(cacheKey);
  const now = Date.now();
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.price;

  // Try direct stable pairs first
  for (const stable of stables) {
    const pairKey = `${chainId}:${baseAddr}:${stable.address}`;
    const pairHit = PRICE_CACHE.get(pairKey);
    let price;
    if (pairHit && now - pairHit.ts < CACHE_TTL_MS) {
      price = pairHit.price;
    } else {
      price = await getBestPairPrice(provider, baseAddr, stable.address, baseDec, stable.decimals);
      if (price && price > 0) PRICE_CACHE.set(pairKey, { price, ts: now });
    }
    if (price && price > 0) return price; // already USD since stable ~1 USD
  }

  // Fallback via WONE route: base->WONE and WONE->USD
  const wone = findBySymbol("WONE");
  if (wone?.address) {
    const woneAddr = wone.address;
    const woneDec = Number(wone.decimals ?? 18);

    const bwKey = `${chainId}:${baseAddr}:${woneAddr}`;
    let basePerWone;
    const bwHit = PRICE_CACHE.get(bwKey);
    if (bwHit && now - bwHit.ts < CACHE_TTL_MS) {
      basePerWone = bwHit.price;
    } else {
      basePerWone = await getBestPairPrice(provider, baseAddr, woneAddr, baseDec, woneDec); // price in WONE
      if (basePerWone && basePerWone > 0) PRICE_CACHE.set(bwKey, { price: basePerWone, ts: now });
    }
    if (basePerWone && basePerWone > 0) {
      // WONE->USD from any stable
      for (const stable of stables) {
        const wuKey = `${chainId}:${woneAddr}:${stable.address}`;
        let woneUsd;
        const wuHit = PRICE_CACHE.get(wuKey);
        if (wuHit && now - wuHit.ts < CACHE_TTL_MS) {
          woneUsd = wuHit.price;
        } else {
          woneUsd = await getBestPairPrice(provider, woneAddr, stable.address, woneDec, stable.decimals);
          if (woneUsd && woneUsd > 0) PRICE_CACHE.set(wuKey, { price: woneUsd, ts: now });
        }
        if (woneUsd && woneUsd > 0) {
          const res = basePerWone * woneUsd;
          PRICE_CACHE.set(cacheKey, { price: res, ts: now });
          return res;
        }
      }
    }
  }

  return null;
}
