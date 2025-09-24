// Example usage of the allowance cache system
// This file demonstrates how to use the cache in different scenarios

import { ethers } from 'ethers';
import allowanceCache from '../services/allowanceCache.js';
import useAllowanceCache from '../hooks/useAllowanceCache.js';

// Example 1: Basic cache usage in a service
export async function exampleServiceUsage(signer, tokenAddress, spenderAddress, amount) {
  const userAddress = await signer.getAddress();
  
  // Check cache first
  const cachedSufficient = allowanceCache.isSufficient(userAddress, tokenAddress, spenderAddress, amount);
  
  if (cachedSufficient === true) {
    console.log('✅ Cache hit - allowance sufficient');
    return true; // No approval needed
  }
  
  if (cachedSufficient === false) {
    console.log('❌ Cache hit - allowance insufficient');
    return false; // Approval needed
  }
  
  console.log('🔍 Cache miss - checking blockchain...');
  // Proceed with blockchain check and cache result
  return null; // Needs blockchain verification
}

// Example 2: React component usage
export function ExampleComponent() {
  const { 
    checkAllowance, 
    isApprovalNeeded, 
    approveToken,
    cacheStats 
  } = useAllowanceCache();

  const handleSwap = async (signer, tokenIn, amount) => {
    const spenderAddress = '0x1fF749824d4086c91caE24175860A95FbDcFEE24'; // Aggregator
    
    try {
      // Check if approval is needed
      const needsApproval = await isApprovalNeeded(signer, tokenIn, spenderAddress, amount);
      
      if (needsApproval) {
        console.log('Requesting token approval...');
        await approveToken(signer, tokenIn, spenderAddress);
        console.log('Token approved and cached');
      }
      
      // Proceed with swap...
      console.log('Executing swap...');
      
    } catch (error) {
      console.error('Swap failed:', error);
    }
  };

  return (
    <div>
      <p>Cache Status: {cacheStats.activeEntries} active entries</p>
      {/* Your component JSX */}
    </div>
  );
}

// Example 3: Cache management scenarios
export class CacheManagementExamples {
  
  // Scenario: User changes wallet
  static onWalletChange() {
    // Clear cache when user switches wallets
    allowanceCache.clear();
    console.log('Cache cleared due to wallet change');
  }
  
  // Scenario: Token approval failed
  static onApprovalError(userAddress, tokenAddress, spenderAddress) {
    // Invalidate specific cache entry on error
    allowanceCache.invalidate(userAddress, tokenAddress, spenderAddress);
    console.log('Cache invalidated due to approval error');
  }
  
  // Scenario: Performance monitoring
  static logCachePerformance() {
    const stats = allowanceCache.getStats();
    const hitRate = stats.totalEntries > 0 
      ? (stats.activeEntries / stats.totalEntries * 100).toFixed(1)
      : 0;
      
    console.log(`Cache performance: ${hitRate}% hit rate, ${stats.activeEntries} active entries`);
  }
  
  // Scenario: Custom TTL for specific tokens
  static cacheWithCustomTTL(userAddress, tokenAddress, spenderAddress, allowance) {
    // Use longer TTL for stablecoins (they're more likely to stay approved)
    const isStablecoin = ['USDC', 'USDT', 'DAI', 'BUSD'].some(symbol => 
      tokenAddress.toLowerCase().includes(symbol.toLowerCase())
    );
    
    const customTTL = isStablecoin ? 60 * 60 * 1000 : 5 * 60 * 1000; // 1h vs 5min
    allowanceCache.set(userAddress, tokenAddress, spenderAddress, allowance, customTTL);
    
    console.log(`Cached with ${isStablecoin ? 'extended' : 'normal'} TTL`);
  }
}

// Example 4: Integration with existing approval flow
export async function enhancedApprovalFlow(tokenContract, userAddress, spenderAddress, requiredAmount) {
  // Check cache first
  const cachedSufficient = allowanceCache.isSufficient(userAddress, tokenContract.target, spenderAddress, requiredAmount);
  
  if (cachedSufficient === true) {
    return { success: true, fromCache: true, txHash: null };
  }
  
  // Blockchain verification needed
  try {
    const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);
    
    // Cache the current allowance
    allowanceCache.set(userAddress, tokenContract.target, spenderAddress, currentAllowance);
    
    if (currentAllowance >= requiredAmount) {
      return { success: true, fromCache: false, txHash: null };
    }
    
    // Approval needed
    console.log('Requesting approval for', requiredAmount.toString());
    
    // Invalidate cache before approval
    allowanceCache.invalidate(userAddress, tokenContract.target, spenderAddress);
    
    const tx = await tokenContract.approve(spenderAddress, ethers.MaxUint256);
    const receipt = await tx.wait();
    
    // Cache the new max allowance
    const maxAllowanceTTL = 30 * 60 * 1000; // 30 minutes
    allowanceCache.set(userAddress, tokenContract.target, spenderAddress, ethers.MaxUint256, maxAllowanceTTL);
    
    return { 
      success: true, 
      fromCache: false, 
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed?.toString()
    };
    
  } catch (error) {
    // Invalidate cache on error
    allowanceCache.invalidate(userAddress, tokenContract.target, spenderAddress);
    throw error;
  }
}

export default {
  exampleServiceUsage,
  ExampleComponent,
  CacheManagementExamples,
  enhancedApprovalFlow
};