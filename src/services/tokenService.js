import tokenList from '../lists/harmony-tokenlist.json';

/**
 * Get the token list.
 * @returns {Array} List of tokens.
 */
export function getTokens() {
  return tokenList.tokens || [];
}

/**
 * Find a token by symbol.
 * @param {string} symbol 
 * @returns {Object|null}
 */
export function findTokenBySymbol(symbol) {
  return getTokens().find((token) => token.symbol === symbol) || null;
}
