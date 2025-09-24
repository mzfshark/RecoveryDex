// src/services/transactionsAPI.js
/**
 * Service for fetching transaction data from external API
 * This centralizes API communication and provides error handling
 */

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'https://whostler.com';

// Use proxy in development to avoid CORS issues
const isDevelopment = import.meta.env.DEV || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.port === '3007' ||
                     window.location.port === '5173';

// In production, always use the correct endpoint regardless of env file
const isProduction = window.location.hostname.includes('dex.country') || 
                    window.location.hostname.includes('whostler.com');

const TRANSACTIONS_ENDPOINT = isDevelopment 
  ? '/api/transactions'  // Use Vite proxy in development
  : 'https://whostler.com/api/transactions';  // Force correct endpoint in production

console.log('[TransactionsAPI] Environment check:', {
  isDevelopment,
  isProduction,
  hostname: window.location.hostname,
  port: window.location.port,
  endpoint: TRANSACTIONS_ENDPOINT,
  envMode: import.meta.env.MODE,
  envDev: import.meta.env.DEV,
  apiBaseUrl: API_BASE_URL
});

/**
 * Fetch transactions from the external API
 * @returns {Promise<Array>} Array of transaction objects
 */
export const fetchTransactions = async () => {
  try {
    console.log('[TransactionsAPI] Fetching from:', TRANSACTIONS_ENDPOINT);
    
    // Create timeout controller for better browser compatibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
    
    const response = await fetch(TRANSACTIONS_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        // Add user agent to help with some API gateways
        'User-Agent': 'RecoverySwap/1.0',
      },
      // Add mode and credentials to handle CORS
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
    });

    clearTimeout(timeoutId); // Clear timeout on successful response

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[TransactionsAPI] Raw API response:', data);

    // Handle different response formats
    let transactions = [];
    
    if (Array.isArray(data)) {
      // Direct array format
      transactions = data;
    } else if (data.transactions && Array.isArray(data.transactions)) {
      // Wrapped format with metadata
      transactions = data.transactions;
    } else if (data.data && Array.isArray(data.data)) {
      // Another common API format
      transactions = data.data;
    } else {
      console.warn('[TransactionsAPI] Unexpected response format:', data);
      throw new Error('Invalid API response format - expected array of transactions');
    }

    console.log(`[TransactionsAPI] Successfully parsed ${transactions.length} transactions`);
    return transactions;

  } catch (error) {
    console.error('[TransactionsAPI] Fetch failed:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - API took too long to respond');
    } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      // This usually indicates CORS issues or network problems
      console.error('[TransactionsAPI] Possible CORS or network issue:', {
        endpoint: TRANSACTIONS_ENDPOINT,
        errorMessage: error.message,
        userAgent: navigator.userAgent
      });
      throw new Error('Network error - Unable to connect to API. This might be a CORS issue or network connectivity problem.');
    } else if (error.name === 'TypeError') {
      throw new Error('Network error - check your internet connection');
    } else if (error.message.includes('HTTP')) {
      throw new Error(`API error: ${error.message}`);
    } else {
      throw new Error(`Unexpected error: ${error.message}`);
    }
  }
};

/**
 * Normalize transaction data to ensure consistent format
 * @param {Object} rawTransaction - Raw transaction from API
 * @param {number} index - Index for fallback ID generation
 * @returns {Object} Normalized transaction
 */
export const normalizeTransaction = (rawTransaction, index = 0) => {
  // Create unique ID by combining multiple fields
  const baseId = rawTransaction.id || rawTransaction.transactionHash || `api-tx-${index}`;
  const uniqueId = rawTransaction.transactionHash 
    ? `${baseId}-${rawTransaction.transactionHash.slice(-8)}-${index}`
    : `${baseId}-${rawTransaction.timestamp || Date.now()}-${index}`;

  return {
    id: uniqueId,
    type: rawTransaction.type || 'Swap',
    user: rawTransaction.user || rawTransaction.from || 'Unknown',
    router: rawTransaction.router || 'Unknown',
    path: Array.isArray(rawTransaction.path) ? rawTransaction.path : [],
    amountIn: rawTransaction.amountIn || '0',
    amountOut: rawTransaction.amountOut || '0',
    slippageBps: rawTransaction.slippageBps || rawTransaction.slippage || '0',
    feeAmount: rawTransaction.feeAmount || rawTransaction.fee || '0',
    transactionHash: rawTransaction.transactionHash || rawTransaction.hash || '',
    blockNumber: rawTransaction.blockNumber || rawTransaction.block || 0,
    timestamp: rawTransaction.timestamp || rawTransaction.time || Date.now(),
    status: normalizeStatus(rawTransaction.status),
  };
};

/**
 * Normalize transaction status
 * @param {string|number|boolean} status - Raw status from API
 * @returns {string} Normalized status
 */
export const normalizeStatus = (status) => {
  if (typeof status === 'boolean') {
    return status ? 'success' : 'failed';
  }
  
  if (typeof status === 'number') {
    return status === 1 ? 'success' : 'failed';
  }
  
  if (typeof status === 'string') {
    const normalized = status.toLowerCase();
    if (['success', 'confirmed', 'complete', 'completed'].includes(normalized)) {
      return 'success';
    } else if (['failed', 'error', 'reverted', 'cancelled'].includes(normalized)) {
      return 'failed';
    } else if (['pending', 'processing', 'confirming'].includes(normalized)) {
      return 'pending';
    }
  }
  
  return 'unknown';
};

/**
 * Fallback fetch with different strategies
 * @returns {Promise<Array>} Array of transaction objects
 */
export const fetchTransactionsFallback = async () => {
  const strategies = [
    // Strategy 1: Simple fetch without extra headers
    async () => {
      console.log('[TransactionsAPI] Trying fallback strategy 1: Simple fetch');
      const response = await fetch(TRANSACTIONS_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    },
    
    // Strategy 2: Fetch with minimal headers
    async () => {
      console.log('[TransactionsAPI] Trying fallback strategy 2: Minimal headers');
      const response = await fetch(TRANSACTIONS_ENDPOINT, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    },
    
    // Strategy 3: Direct endpoint without proxy (production fallback)
    async () => {
      console.log('[TransactionsAPI] Trying fallback strategy 3: Direct endpoint');
      const directEndpoint = 'https://whostler.com/api/transactions';
      const response = await fetch(directEndpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    }
  ];

  let lastError = null;
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = await strategies[i]();
      console.log(`[TransactionsAPI] Fallback strategy ${i + 1} succeeded`);
      return result;
    } catch (error) {
      console.warn(`[TransactionsAPI] Fallback strategy ${i + 1} failed:`, error.message);
      lastError = error;
    }
  }
  
  throw new Error(`All fallback strategies failed. Last error: ${lastError?.message}`);
};

/**
 * Test API connectivity and CORS
 * @returns {Promise<Object>} Test result with details
 */
export const testAPIConnectivity = async () => {
  const testResult = {
    endpoint: TRANSACTIONS_ENDPOINT,
    timestamp: new Date().toISOString(),
    success: false,
    error: null,
    responseTime: 0,
    corsEnabled: false,
    dataReceived: false
  };

  const startTime = Date.now();

  try {
    console.log('[TransactionsAPI] Testing connectivity to:', TRANSACTIONS_ENDPOINT);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds for test
    
    const response = await fetch(TRANSACTIONS_ENDPOINT, {
      method: 'HEAD', // Use HEAD first to test connectivity without downloading data
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    testResult.responseTime = Date.now() - startTime;
    
    if (response.ok) {
      testResult.corsEnabled = true;
      
      // Try to get actual data
      const dataController = new AbortController();
      const dataTimeoutId = setTimeout(() => dataController.abort(), 5000);
      
      const dataResponse = await fetch(TRANSACTIONS_ENDPOINT, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: dataController.signal,
      });
      
      clearTimeout(dataTimeoutId);
      
      if (dataResponse.ok) {
        const data = await dataResponse.json();
        testResult.dataReceived = Array.isArray(data?.transactions) || Array.isArray(data);
        testResult.success = true;
      }
    } else {
      testResult.error = `HTTP ${response.status}: ${response.statusText}`;
    }

  } catch (error) {
    testResult.responseTime = Date.now() - startTime;
    testResult.error = error.message;
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      testResult.error = 'CORS blocked or network unreachable';
    }
  }

  console.log('[TransactionsAPI] Connectivity test result:', testResult);
  return testResult;
};

/**
 * Get API endpoint URL for debugging
 * @returns {string} API endpoint URL
 */
export const getAPIEndpoint = () => TRANSACTIONS_ENDPOINT;

export default {
  fetchTransactions,
  normalizeTransaction,
  normalizeStatus,
  getAPIEndpoint,
};