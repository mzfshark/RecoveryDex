// src/utils/wrappedCurrency.js
import { ChainId, Token } from '@uniswap/sdk'

// Harmony ONE address to be wrapped
const WRAPPED_TOKENS = {
  [ChainId.MAINNET]: new Token(
    ChainId.MAINNET,
    '0xcf664087a5bb0237a0bad6742852ec6c8d69a27a', // WONE address
    18,
    'WONE',
    'Wrapped ONE'
  )
}

/**
 * Retorna o token "wrapped" correspondente à moeda (caso seja nativa)
 * @param {import('@uniswap/sdk').Currency} currency
 * @param {number} chainId
 * @returns {import('@uniswap/sdk').Token | null}
 */
export function wrappedCurrency(currency, chainId) {
  if (!currency || !chainId) return null;

  if (currency instanceof Token) return currency;

  return WRAPPED_TOKENS[chainId] || null;
}