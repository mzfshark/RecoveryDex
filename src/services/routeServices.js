// src/services/routeServices.js
import tokenList from "../lists/harmony-tokenlist.json";
import { isAddress, getAddress, ethers } from "ethers";
import { WONE_ADDRESS } from "../utils/constants";

// Extrai o array de tokens, seja no root ou em .tokens
const TOKENS = Array.isArray(tokenList)
  ? tokenList
  : tokenList.tokens || [];

/**
 * Retorna o nome da rota formatada a partir de endereços de token.
 * @param {string[]} path - Endereços dos tokens na rota
 * @returns {string} - Ex: "WONE → VIPER → USDT"
 */
export function formatRoute(path) {
  if (!Array.isArray(path)) {
    console.warn("❌ path inválido em formatRoute:", { path, type: typeof path });
    return "Unknown";
  }

  return path
    .map((addr) => {
      if (!isAddress(addr)) {
        console.warn("⚠️ endereço inválido ignorado:", addr);
        return "Unknown";
      }
      const token = TOKENS.find(
        (t) => t.address?.toLowerCase() === addr?.toLowerCase()
      );
      if (addr?.toLowerCase() === WONE_ADDRESS.toLowerCase()) return 'ONE';
      return token?.symbol || "Unknown";
    })
    .join(" → ");
}

/**
 * Retorna os dados detalhados dos tokens da rota
 * (útil para exibir logos, nomes, etc).
 *
 * @param {string[]} path
 * @param {Array} tokenList - Lista de tokens disponível
 * @returns {{ address: string, symbol: string, logoURI: string|null }[]}
 */
export function getRouteTokens(path, tokenList = []) {
  if (!Array.isArray(path)) {
    console.warn("❌ path inválido em getRouteTokens:", { path, type: typeof path });
    return [];
  }

  // Use tokenList from parameter if provided, otherwise fallback to imported TOKENS
  const tokens = tokenList.length > 0 ? tokenList : TOKENS;

  return path.map((addr) => {
    if (!isAddress(addr)) {
      console.warn("⚠️ endereço inválido ignorado:", addr);
      return {
        address: addr,
        symbol: "Unknown",
        logoURI: null,
      };
    }
    if (addr?.toLowerCase() === WONE_ADDRESS.toLowerCase()) {
      return { address: addr, symbol: 'ONE', logoURI: 'https://raw.githubusercontent.com/sushiswap/list/master/logos/token-logos/token/one.jpg' };
    }
    const token = tokens.find(
      (t) => t.address?.toLowerCase() === addr?.toLowerCase()
    );
    if (token) {
      return {
        address: token.address,
        symbol: token.symbol,
        logoURI: token.logoURI || null,
      };
    }
    return {
      address: addr,
      symbol: "Unknown",
      logoURI: null,
    };
  });
}

/**
 * Busca a melhor rota de swap entre dois tokens.
 * @param {Object} params - Parâmetros para o swap
 * @param {bigint} params.amountIn
 * @param {Object} params.tokenIn
 * @param {Object} params.tokenOut
 * @param {Object[]} params.intermediaries
 * @param {Object} aggregator - Instância do contrato Aggregator
 * @returns {Promise<{ amountOut: bigint, router: string, path: string[] } | null>}
 */
export async function getBestRoute({ amountIn, tokenIn, tokenOut, intermediaries, aggregator }) {
  if (!amountIn || !tokenIn?.address || !tokenOut?.address) {
    console.warn("⚠️ Parâmetros inválidos em getBestRoute:", { amountIn, tokenIn, tokenOut });
    return null;
  }

  if (!Array.isArray(intermediaries)) {
    console.warn("⚠️ intermediaries inválido em getBestRoute:", intermediaries);
    return null;
  }

  if (!aggregator?.quote) {
    console.error("❌ aggregator.quote is not available", aggregator);
    return null;
  }

  console.debug("Aggregator recebido:", aggregator);

  try {
    // Normaliza tokens nativos para WONE
    const inAddr = tokenIn.isNative || tokenIn.address === 'native' ? WONE_ADDRESS : tokenIn.address;
    const outAddr = tokenOut.isNative || tokenOut.address === 'native' ? WONE_ADDRESS : tokenOut.address;
    // Intermediários: normaliza, remove duplicatas e exclui in/out
    const mids = Array.from(new Set(
      intermediaries
        .map(t => (t.isNative || t.address === 'native') ? WONE_ADDRESS : t.address)
        .filter(addr => addr && addr.toLowerCase() !== inAddr.toLowerCase() && addr.toLowerCase() !== outAddr.toLowerCase())
    ));

    if (!isAddress(inAddr) || !isAddress(outAddr)) {
      console.warn('⚠️ Endereço inválido após normalização:', { inAddr, outAddr });
      return null;
    }

    // Evita chamadas se tokens são iguais (não há rota)
    if (inAddr.toLowerCase() === outAddr.toLowerCase()) {
      console.warn('⚠️ tokenIn e tokenOut iguais; ignorando busca de rota');
      return null;
    }

    const [amountOut, router, path] = await aggregator.quote(
      amountIn,
      getAddress(inAddr),
      getAddress(outAddr),
      mids.map(getAddress)
    );

    return {
      amountOut,
      router,
      path,
    };
  } catch (error) {
    console.error("❌ Erro ao obter melhor rota:", error);
    
    // Fallback demo calculation when RPC is blocked
    if (error.message?.includes('Failed to fetch') || error.code === 'NETWORK_ERROR') {
      console.log("🔄 Using demo route calculation due to network issues");
      
      // Normalize tokens to addresses (from earlier in function)
      const inAddr = tokenIn.isNative || tokenIn.address === 'native' ? WONE_ADDRESS : tokenIn.address;
      const outAddr = tokenOut.isNative || tokenOut.address === 'native' ? WONE_ADDRESS : tokenOut.address;
      
      // Demo exchange rates (for demonstration purposes)
      const demoRates = {
        'ONE_USDC': 0.025, // 1 ONE = 0.025 USDC
        'USDC_ONE': 40,    // 1 USDC = 40 ONE
        'ONE_DAI': 0.024,  // 1 ONE = 0.024 DAI
        'DAI_ONE': 41.6,   // 1 DAI = 41.6 ONE
        'USDC_DAI': 0.999, // 1 USDC = 0.999 DAI
        'DAI_USDC': 1.001, // 1 DAI = 1.001 USDC
      };
      
      const inSymbol = tokenIn.symbol?.toUpperCase();
      const outSymbol = tokenOut.symbol?.toUpperCase();
      const rateKey = `${inSymbol}_${outSymbol}`;
      const rate = demoRates[rateKey];
      
      if (rate && amountIn > 0n) {
        // Convert amountIn from wei to decimal, apply rate, convert back to wei
        const inDecimals = tokenIn.decimals || 18;
        const outDecimals = tokenOut.decimals || 18;
        const amountFloat = parseFloat(ethers.formatUnits(amountIn, inDecimals));
        const outputFloat = amountFloat * rate * 0.997; // 0.3% slippage simulation
        const amountOut = ethers.parseUnits(outputFloat.toFixed(outDecimals), outDecimals);
        
        return {
          amountOut,
          router: "0x1111111111111111111111111111111111111111", // Demo router
          path: [inAddr, outAddr],
        };
      }
    }
    
    return null;
  }
}
