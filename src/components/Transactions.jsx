// src/components/Transactions.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useContract } from '../context/ContractContext';
import { ethers } from 'ethers';
import Loading from './Loading';
import styles from '../styles/Global.module.css';
import { fetchTransactions, normalizeTransaction, testAPIConnectivity, fetchTransactionsFallback } from '../services/transactionsAPI';

const Transactions = () => {
  const { provider, loading: contextLoading } = useContract();
  const [transactions, setTransactions] = useState([]);
  const [isLoadingTxs, setIsLoadingTxs] = useState(false);
  const [error, setError] = useState(null);
  const [onlyUser, setOnlyUser] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  // Auto-refresh configuration
  const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

  // Function to get transaction status from receipt (mantido para verificações locais se necessário)
  const getTransactionStatus = useCallback(async (txHash) => {
    if (!provider) return 'pending';
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      return receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending';
    } catch (error) {
      console.warn('Failed to get transaction status:', error);
      return 'unknown';
    }
  }, [provider]);

  // Function to format token addresses to symbols
  const formatTokenPath = useCallback((path) => {
    if (!Array.isArray(path)) return 'Unknown';
    // For now, just show first 6 chars of each address
    return path.map(addr => `${addr.slice(0, 6)}...`).join(' → ');
  }, []);

  // Function to format amount
  const formatAmount = useCallback((amount, decimals = 18) => {
    try {
      return parseFloat(ethers.formatUnits(amount, decimals)).toFixed(4);
    } catch {
      return 'N/A';
    }
  }, []);

  // Normalize address for filtering
  const normalizeAddress = (addr) => {
    try { return ethers.getAddress(addr); } catch { return (addr||'').toLowerCase(); }
  };

  // Fetch transactions from API using centralized service
  const fetchTransactionsFromAPI = useCallback(async () => {
    console.log('[Transactions] Fetching from API using service');
    
    setIsLoadingTxs(true);
    setError(null);
    setDebugInfo(null);
    
    try {
      let rawTransactions;
      
      try {
        rawTransactions = await fetchTransactions();
      } catch (primaryError) {
        console.warn('[Transactions] Primary fetch failed, trying fallback:', primaryError.message);
        
        // Try fallback strategies
        try {
          const fallbackData = await fetchTransactionsFallback();
          // Handle different response formats from fallback
          rawTransactions = Array.isArray(fallbackData) ? fallbackData : 
                           fallbackData.transactions || fallbackData.data || [];
        } catch (fallbackError) {
          console.error('[Transactions] Fallback also failed:', fallbackError.message);
          throw primaryError; // Throw the original error
        }
      }
      
      // Normalize transaction data using service
      const processedTransactions = rawTransactions.map((tx, index) => 
        normalizeTransaction(tx, index)
      );

      // Sort by timestamp (newest first)
      processedTransactions.sort((a, b) => b.timestamp - a.timestamp);

      // Apply user filter if enabled
      let filteredTransactions = processedTransactions;
      if (onlyUser && provider) {
        try {
          const signerAddr = await provider.getSigner().then(s => s.getAddress()).catch(() => null);
          console.log('[Transactions] Filtering by user:', signerAddr);
          if (signerAddr) {
            const norm = normalizeAddress(signerAddr);
            filteredTransactions = processedTransactions.filter(tx => 
              normalizeAddress(tx.user) === norm
            );
            console.log(`[Transactions] Filtered from ${processedTransactions.length} to ${filteredTransactions.length} transactions`);
          }
        } catch (err) {
          console.warn('[Transactions] Failed to get signer for filtering:', err);
        }
      }

      setTransactions(filteredTransactions);
      setLastFetch(Date.now());
      console.log(`[Transactions] Successfully loaded ${filteredTransactions.length} transactions from API`);

    } catch (err) {
      console.error('[Transactions] API fetch failed:', err);
      setError(`Failed to load transactions: ${err.message}`);
      
      // Run connectivity test for debugging
      try {
        const debugResult = await testAPIConnectivity();
        setDebugInfo(debugResult);
      } catch (debugErr) {
        console.error('[Transactions] Debug test failed:', debugErr);
      }
    } finally {
      setIsLoadingTxs(false);
    }
  }, [onlyUser, provider]);

  // Load transactions from API on mount and when filters change
  useEffect(() => {
    console.log('[Transactions] Effect triggered - fetching from API');
    fetchTransactionsFromAPI();
  }, [fetchTransactionsFromAPI]);

  // Auto-refresh transactions periodically
  useEffect(() => {
    if (!AUTO_REFRESH_INTERVAL) return;

    const interval = setInterval(() => {
      console.log('[Transactions] Auto-refresh triggered');
      fetchTransactionsFromAPI();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchTransactionsFromAPI, AUTO_REFRESH_INTERVAL]);

  const getStatusBadge = (status) => {
    const badgeClass = {
      success: styles.successBadge || 'badge-success',
      failed: styles.errorBadge || 'badge-error', 
      pending: styles.pendingBadge || 'badge-pending',
      unknown: styles.unknownBadge || 'badge-unknown'
    }[status] || 'badge-unknown';

    return (
      <span className={`badge ${badgeClass}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (contextLoading) {
    return <Loading message="Initializing blockchain connection..." />;
  }

  return (
    <div className={styles.transactionContainer}>
      <div className={styles.transactionsHeader}>
        <h2>Recent Transactions</h2>
        <div className={styles.flexRowGap}>
          <label style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:12}}>
            <input type="checkbox" checked={onlyUser} onChange={(e)=> setOnlyUser(e.target.checked)} /> Only my address
          </label>
          {lastFetch && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Last updated: {new Date(lastFetch).toLocaleTimeString()}
            </span>
          )}
          <button 
            onClick={fetchTransactionsFromAPI} 
            disabled={isLoadingTxs}
            className={styles.refreshButton}
          >
            {isLoadingTxs ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className={styles.spinner} style={{ width: '16px', height: '16px' }}></div>
                Loading...
              </span>
            ) : (
              'Refresh'
            )}
          </button>
          {error && (
            <button 
              onClick={async () => {
                setDebugInfo(null);
                const result = await testAPIConnectivity();
                setDebugInfo(result);
              }}
              className={styles.debugButton}
              style={{ 
                fontSize: '12px', 
                padding: '4px 8px',
                backgroundColor: 'var(--warning)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Test API
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
          {debugInfo && (
            <details style={{ marginTop: '8px', fontSize: '12px' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--accent)' }}>
                Debug Information (Click to expand)
              </summary>
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                backgroundColor: 'rgba(0,0,0,0.1)', 
                borderRadius: '4px',
                fontFamily: 'monospace'
              }}>
                <div><strong>Endpoint:</strong> {debugInfo.endpoint}</div>
                <div><strong>Success:</strong> {debugInfo.success ? '✅' : '❌'}</div>
                <div><strong>Response Time:</strong> {debugInfo.responseTime}ms</div>
                <div><strong>CORS Enabled:</strong> {debugInfo.corsEnabled ? '✅' : '❌'}</div>
                <div><strong>Data Received:</strong> {debugInfo.dataReceived ? '✅' : '❌'}</div>
                {debugInfo.error && (
                  <div><strong>Error:</strong> {debugInfo.error}</div>
                )}
                <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.7 }}>
                  Test performed at: {debugInfo.timestamp}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {!isLoadingTxs && transactions.length === 0 && (
        <div className={styles.emptyState}>
          <p>No transactions found.</p>
          <p>Transactions are fetched from our API which aggregates swap data from the blockchain.</p>
          <p>If you recently made a swap, it may take a few minutes to appear here.</p>
          {error && (
            <p style={{ color: 'var(--accent)', marginTop: '8px' }}>
              Error: {error}
            </p>
          )}
        </div>
      )}

      {!isLoadingTxs && transactions.length > 0 && (
        <div className={styles.transactionsTable}>
          <div className={styles.tableHeader}>
            <div>Status</div>
            <div>Type</div>
            <div>Amount In</div>
            <div>Amount Out</div>
            <div>Path</div>
            <div>Transaction</div>
          </div>
          
          {transactions.map((tx) => (
            <div key={tx.id} className={styles.tableRow}>
              <div>{getStatusBadge(tx.status)}</div>
              <div>{tx.type}</div>
              <div>{formatAmount(tx.amountIn)}</div>
              <div>{formatAmount(tx.amountOut)}</div>
              <div className={styles.pathCell}>
                {formatTokenPath(tx.path)}
              </div>
              <div>
                <a 
                  href={`https://explorer.harmony.one/tx/${tx.transactionHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.txLink}
                >
                  {tx.transactionHash.slice(0, 10)}...
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Transactions;

