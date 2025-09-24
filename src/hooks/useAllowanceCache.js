// src/hooks/useAllowanceCache.js
/**
 * React hook for managing token allowances with cache
 * Provides easy access to allowance cache functionality in components
 */

import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import allowanceCache from '../services/allowanceCache.js';
import ERC20ABI from '../abis/ERC20ABI.json';

export const useAllowanceCache = () => {
  const [cacheStats, setCacheStats] = useState(allowanceCache.getStats());

  // Update cache stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(allowanceCache.getStats());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  /**
   * Check if allowance is sufficient (with cache)
   * @param {string} userAddress - User wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Spender contract address
   * @param {bigint} requiredAmount - Required amount
   * @returns {boolean|null} True if sufficient, false if not, null if not cached
   */
  const checkAllowance = useCallback((userAddress, tokenAddress, spenderAddress, requiredAmount) => {
    if (!userAddress || !tokenAddress || !spenderAddress) return null;
    return allowanceCache.isSufficient(userAddress, tokenAddress, spenderAddress, requiredAmount);
  }, []);

  /**
   * Check allowance directly from blockchain and cache result
   * @param {Object} signer - Ethers signer
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Spender contract address
   * @returns {Promise<bigint>} Current allowance amount
   */
  const fetchAllowance = useCallback(async (signer, tokenAddress, spenderAddress) => {
    if (!signer || !tokenAddress || !spenderAddress) {
      throw new Error('Missing required parameters for allowance fetch');
    }

    const userAddress = await signer.getAddress();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, signer);
    const allowance = await tokenContract.allowance(userAddress, spenderAddress);

    // Cache the result
    allowanceCache.set(userAddress, tokenAddress, spenderAddress, allowance);

    return allowance;
  }, []);

  /**
   * Approve token spending and cache the result
   * @param {Object} signer - Ethers signer
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Spender contract address
   * @param {bigint} amount - Amount to approve (optional, defaults to MaxUint256)
   * @returns {Promise<Object>} Transaction receipt
   */
  const approveToken = useCallback(async (signer, tokenAddress, spenderAddress, amount = ethers.MaxUint256) => {
    if (!signer || !tokenAddress || !spenderAddress) {
      throw new Error('Missing required parameters for token approval');
    }

    const userAddress = await signer.getAddress();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, signer);

    // Invalidate cache before approval
    allowanceCache.invalidate(userAddress, tokenAddress, spenderAddress);

    const tx = await tokenContract.approve(spenderAddress, amount);
    const receipt = await tx.wait();

    // Cache the new allowance with appropriate TTL
    const isMaxApproval = amount === ethers.MaxUint256;
    const ttl = isMaxApproval ? 30 * 60 * 1000 : 5 * 60 * 1000; // 30min for max, 5min for specific amount
    allowanceCache.set(userAddress, tokenAddress, spenderAddress, amount, ttl);

    console.log(`[useAllowanceCache] Token approved and cached: ${tokenAddress.slice(0,8)}...`);
    return receipt;
  }, []);

  /**
   * Check if approval is needed for a specific amount
   * @param {Object} signer - Ethers signer
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Spender contract address
   * @param {bigint} requiredAmount - Required amount
   * @returns {Promise<boolean>} True if approval is needed
   */
  const isApprovalNeeded = useCallback(async (signer, tokenAddress, spenderAddress, requiredAmount) => {
    if (!signer || !tokenAddress || !spenderAddress) return false;

    const userAddress = await signer.getAddress();
    
    // Check cache first
    const cachedSufficient = allowanceCache.isSufficient(userAddress, tokenAddress, spenderAddress, requiredAmount);
    
    if (cachedSufficient === true) {
      return false; // No approval needed
    }
    
    if (cachedSufficient === false) {
      return true; // Approval needed
    }
    
    // Cache miss - check blockchain
    try {
      const allowance = await fetchAllowance(signer, tokenAddress, spenderAddress);
      return allowance < requiredAmount;
    } catch (error) {
      console.error('[useAllowanceCache] Failed to check allowance:', error);
      return true; // Assume approval needed on error
    }
  }, [fetchAllowance]);

  /**
   * Invalidate cached allowance for specific token/spender combination
   * @param {string} userAddress - User wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Spender contract address
   */
  const invalidateCache = useCallback((userAddress, tokenAddress, spenderAddress) => {
    allowanceCache.invalidate(userAddress, tokenAddress, spenderAddress);
  }, []);

  /**
   * Clear all cached allowances
   */
  const clearCache = useCallback(() => {
    allowanceCache.clear();
    setCacheStats(allowanceCache.getStats());
  }, []);

  /**
   * Get formatted cache statistics
   * @returns {Object} Cache statistics with formatted values
   */
  const getFormattedStats = useCallback(() => {
    const stats = allowanceCache.getStats();
    return {
      ...stats,
      hitRate: stats.totalEntries > 0 ? ((stats.activeEntries / stats.totalEntries) * 100).toFixed(1) + '%' : '0%',
      ttlMinutes: Math.round(stats.defaultTTL / 60000),
      usagePercent: ((stats.totalEntries / stats.maxSize) * 100).toFixed(1) + '%'
    };
  }, []);

  return {
    // Cache management
    checkAllowance,
    fetchAllowance,
    approveToken,
    isApprovalNeeded,
    invalidateCache,
    clearCache,
    
    // Statistics
    cacheStats,
    getFormattedStats,
    
    // Direct cache access (for advanced usage)
    cache: allowanceCache
  };
};

export default useAllowanceCache;