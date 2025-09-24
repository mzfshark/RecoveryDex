// src/services/allowanceCache.js
/**
 * Cache service for token allowances to avoid redundant blockchain calls
 * Uses in-memory cache with TTL (Time To Live) expiration
 */

class AllowanceCache {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
    this.maxCacheSize = 1000; // Maximum number of cached entries
    
    // Clean expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
    
    console.log('[AllowanceCache] Initialized with TTL:', this.defaultTTL, 'ms');
  }

  /**
   * Generate cache key for allowance lookup
   * @param {string} userAddress - User wallet address
   * @param {string} tokenAddress - Token contract address  
   * @param {string} spenderAddress - Spender (aggregator) contract address
   * @returns {string} Cache key
   */
  generateKey(userAddress, tokenAddress, spenderAddress) {
    return `${userAddress.toLowerCase()}_${tokenAddress.toLowerCase()}_${spenderAddress.toLowerCase()}`;
  }

  /**
   * Store allowance in cache with expiration
   * @param {string} userAddress - User wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Spender contract address
   * @param {bigint} allowance - Current allowance amount
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(userAddress, tokenAddress, spenderAddress, allowance, ttl = this.defaultTTL) {
    const key = this.generateKey(userAddress, tokenAddress, spenderAddress);
    const expiration = Date.now() + ttl;
    
    // If cache is getting too large, remove oldest entries
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      allowance: allowance.toString(), // Store as string to avoid BigInt serialization issues
      expiration,
      timestamp: Date.now()
    });
    
    console.log(`[AllowanceCache] Cached allowance for ${tokenAddress.slice(0,8)}... TTL: ${ttl}ms`);
  }

  /**
   * Get cached allowance if not expired
   * @param {string} userAddress - User wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Spender contract address
   * @returns {bigint|null} Cached allowance or null if not found/expired
   */
  get(userAddress, tokenAddress, spenderAddress) {
    const key = this.generateKey(userAddress, tokenAddress, spenderAddress);
    const entry = this.cache.get(key);
    
    if (!entry) {
      console.log(`[AllowanceCache] Cache miss for ${tokenAddress.slice(0,8)}...`);
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiration) {
      console.log(`[AllowanceCache] Cache expired for ${tokenAddress.slice(0,8)}...`);
      this.cache.delete(key);
      return null;
    }
    
    console.log(`[AllowanceCache] Cache hit for ${tokenAddress.slice(0,8)}... allowance:`, entry.allowance);
    return BigInt(entry.allowance);
  }

  /**
   * Check if allowance is sufficient for amount (with cache lookup)
   * @param {string} userAddress - User wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Spender contract address
   * @param {bigint} requiredAmount - Required amount for operation
   * @returns {boolean|null} True if sufficient, false if not, null if not cached
   */
  isSufficient(userAddress, tokenAddress, spenderAddress, requiredAmount) {
    const cachedAllowance = this.get(userAddress, tokenAddress, spenderAddress);
    
    if (cachedAllowance === null) {
      return null; // Not cached
    }
    
    const sufficient = cachedAllowance >= requiredAmount;
    console.log(`[AllowanceCache] Allowance check: ${cachedAllowance.toString()} >= ${requiredAmount.toString()} = ${sufficient}`);
    return sufficient;
  }

  /**
   * Invalidate specific allowance (call after approve transaction)
   * @param {string} userAddress - User wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Spender contract address
   */
  invalidate(userAddress, tokenAddress, spenderAddress) {
    const key = this.generateKey(userAddress, tokenAddress, spenderAddress);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      console.log(`[AllowanceCache] Invalidated cache for ${tokenAddress.slice(0,8)}...`);
    }
  }

  /**
   * Clear all cached allowances
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[AllowanceCache] Cleared ${size} entries`);
  }

  /**
   * Remove expired entries from cache
   */
  cleanup() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiration) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`[AllowanceCache] Cleanup removed ${removedCount} expired entries`);
    }
  }

  /**
   * Remove oldest entries to make room for new ones
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTimestamp = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`[AllowanceCache] Evicted oldest entry`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiration) {
        expiredCount++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      activeEntries: this.cache.size - expiredCount,
      maxSize: this.maxCacheSize,
      defaultTTL: this.defaultTTL
    };
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    console.log('[AllowanceCache] Destroyed');
  }
}

// Create singleton instance
export const allowanceCache = new AllowanceCache();

// Export class for testing
export { AllowanceCache };

export default allowanceCache;