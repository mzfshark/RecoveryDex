// src/services/blockscoutService.js
import { ethers } from "ethers";
import { notify } from "./notificationService.js";

/**
 * Blockscout API service for Harmony network
 * Optimized LP discovery using token holdings
 */

const BLOCKSCOUT_BASE_URL = 'https://explorer.harmony.one/api';

class BlockscoutService {
  constructor() {
    this.baseUrl = BLOCKSCOUT_BASE_URL;
  }

  /**
   * Fetch all ERC20 tokens held by an address
   * @param {string} address - User wallet address
   * @returns {Promise<Array>} Array of token holdings
   */
  async getTokenHoldings(address) {
    try {
      console.log(`[Blockscout] Fetching token holdings for ${address}`);
      
      const response = await fetch(
        `${this.baseUrl}?module=account&action=tokenlist&address=${address}`
      );
      
      if (!response.ok) {
        throw new Error(`Blockscout API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status !== '1') {
        console.warn(`[Blockscout] API returned status: ${data.status}, message: ${data.message}`);
        // Return empty array instead of throwing to allow fallback
        return [];
      }
      
      return data.result || [];
    } catch (error) {
      console.error('[Blockscout] Error fetching token holdings:', error);
      throw error;
    }
  }

  /**
   * Filter tokens to identify potential LP tokens
   * @param {Array} tokens - Token holdings from API
   * @returns {Array} Filtered LP tokens
   */
  filterLPTokens(tokens) {
    console.log(`[Blockscout] Filtering ${tokens.length} tokens for LP patterns`);
    
    const filtered = tokens.filter(token => {
      const symbol = (token.symbol || '').toLowerCase();
      const name = (token.name || '').toLowerCase();
      
      // Common LP token patterns
      const lpPatterns = [
        '-lp',      // Standard LP suffix
        'lp-',      // LP prefix
        '-v2',      // Uniswap V2 pattern
        'uni-v2',   // Uniswap V2 prefix
        'cake-lp',  // PancakeSwap pattern
        'slp',      // SushiSwap LP
        'viper-lp', // ViperSwap LP
        'dfl-lp',   // Defira LP
        'dfk-lp',   // DFK LP
        'elk-lp',   // Elk LP
        'mochi-lp', // Mochi LP
        'openx-lp', // OpenX LP
        'fuzz-lp',  // Fuzz LP
      ];
      
      // Check if token has LP-like patterns in symbol or name
      const hasLPPattern = lpPatterns.some(pattern => 
        symbol.includes(pattern) || name.includes(pattern)
      );
      
      // Additional checks for pair-like names (TOKEN1-TOKEN2)
      const hasPairPattern = (
        symbol.includes('-') && 
        symbol.split('-').length >= 2 &&
        !symbol.includes('wrapped') &&
        !symbol.includes('w') // Avoid wrapped tokens
      );
      
      // Check for common pair separators
      const hasSeparators = symbol.includes('/') || symbol.includes('_');
      
      // Exclude obvious non-LP tokens
      const excludePatterns = [
        'wrapped',
        'wone',
        'weth',
        'wbtc',
        'usdc',
        'usdt',
        'dai',
        'busd'
      ];
      
      const isExcluded = excludePatterns.some(pattern => 
        symbol.includes(pattern) || name.includes(pattern)
      );
      
      return (hasLPPattern || hasPairPattern || hasSeparators) && !isExcluded;
    });
    
    console.log(`[Blockscout] Found ${filtered.length} potential LP tokens`);
    return filtered;
  }

  /**
   * Get detailed token information
   * @param {string} tokenAddress - Token contract address
   * @returns {Promise<Object>} Token details
   */
  async getTokenDetails(tokenAddress) {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=token&action=getToken&contractaddress=${tokenAddress}`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('[Blockscout] Error fetching token details:', error);
      return null;
    }
  }

  /**
   * Get token transfers for an address (alternative method)
   * @param {string} address - User wallet address
   * @param {number} page - Page number for pagination
   * @returns {Promise<Array>} Token transfers
   */
  async getTokenTransfers(address, page = 1) {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=account&action=tokentx&address=${address}&page=${page}&offset=100&sort=desc`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error('[Blockscout] Error fetching token transfers:', error);
      return [];
    }
  }

  /**
   * Extract unique LP tokens from transfers (fallback method)
   * @param {string} address - User wallet address
   * @returns {Promise<Array>} LP tokens from transfers
   */
  async getLPTokensFromTransfers(address) {
    try {
      console.log(`[Blockscout] Trying transfers method for ${address}`);
      
      const transfers = await this.getTokenTransfers(address);
      console.log(`[Blockscout] Found ${transfers.length} token transfers`);
      
      // Extract unique token contracts from transfers
      const uniqueTokens = new Map();
      
      transfers.forEach(transfer => {
        const tokenAddress = transfer.contractAddress;
        const tokenSymbol = transfer.tokenSymbol;
        const tokenName = transfer.tokenName;
        
        if (!uniqueTokens.has(tokenAddress)) {
          uniqueTokens.set(tokenAddress, {
            contractAddress: tokenAddress,
            symbol: tokenSymbol,
            name: tokenName,
            decimals: transfer.tokenDecimal || '18',
            balance: '0' // Will be checked later
          });
        }
      });
      
      const allTokens = Array.from(uniqueTokens.values());
      return this.filterLPTokens(allTokens);
      
    } catch (error) {
      console.error('[Blockscout] Error in transfers method:', error);
      return [];
    }
  }

  /**
   * Main method: Get LP tokens for an address
   * @param {string} address - User wallet address
   * @returns {Promise<Array>} LP tokens with balances
   */
  async getLPTokensForAddress(address) {
    try {
      console.log(`[Blockscout] Starting LP discovery for ${address}`);
      
      let potentialLPs = [];
      
      // Method 1: Try token list API first
      try {
        const allTokens = await this.getTokenHoldings(address);
        console.log(`[Blockscout] Method 1 - Found ${allTokens.length} total tokens`);
        
        if (allTokens.length > 0) {
          potentialLPs = this.filterLPTokens(allTokens);
        }
      } catch (error) {
        console.warn('[Blockscout] Method 1 (tokenlist) failed:', error.message);
      }
      
      // Method 2: If tokenlist failed or found nothing, try transfers
      if (potentialLPs.length === 0) {
        try {
          console.log('[Blockscout] Falling back to transfers method...');
          potentialLPs = await this.getLPTokensFromTransfers(address);
        } catch (error) {
          console.warn('[Blockscout] Method 2 (transfers) failed:', error.message);
        }
      }
      
      if (potentialLPs.length === 0) {
        console.log('[Blockscout] No potential LP tokens found via API methods');
        return [];
      }
      
      // Filter out tokens with zero balance (for tokenlist method)
      const validLPs = potentialLPs
        .filter(token => {
          const balance = parseFloat(token.balance || '0');
          return balance > 0 || !token.balance; // Include if balance not available (from transfers)
        })
        .map(token => ({
          address: token.contractAddress,
          symbol: token.symbol || 'Unknown',
          name: token.name || 'Unknown Token',
          balance: token.balance || '0',
          decimals: parseInt(token.decimals || '18'),
          type: token.type || 'ERC-20'
        }));
      
      console.log(`[Blockscout] Returning ${validLPs.length} potential LP tokens for validation`);
      return validLPs;
      
    } catch (error) {
      console.error('[Blockscout] Error in getLPTokensForAddress:', error);
      throw error;
    }
  }

  /**
   * Check if Blockscout API is available
   * @returns {Promise<boolean>} API availability
   */
  async checkAPIAvailability() {
    try {
      const response = await fetch(`${this.baseUrl}?module=stats&action=ethsupply`, {
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.warn('[Blockscout] API availability check failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const blockscoutService = new BlockscoutService();
export default blockscoutService;