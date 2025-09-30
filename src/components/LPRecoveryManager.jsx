// src/components/LPRecoveryManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import lpRecoveryService from '../services/lpRecoveryService';
import { getProvider } from '../services/provider';
import { notify } from '../services/notificationService';
import { useAppKitSafe } from '../hooks/useAppKitSafe';
import styles from '../styles/Global.module.css';

const LPRecoveryManager = () => {
  // Use safe AppKit hook
  const { address, isConnected, open, isAppKitReady } = useAppKitSafe();
  
  const [userLPs, setUserLPs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLPs, setSelectedLPs] = useState(new Set());
  const [searchAddress, setSearchAddress] = useState('');
  const [processing, setProcessing] = useState(false);

  // Initialize service when connecting
  useEffect(() => {
    if (isConnected && address) {
      initializeService();
      setSearchAddress(address);
    }
  }, [isConnected, address]);

  const initializeService = async () => {
    try {
      const provider = getProvider();
      if (!provider) {
        throw new Error("Provider not available");
      }
      
      let signer = null;
      if (isConnected && window.ethereum) {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await browserProvider.getSigner();
      }
      
      await lpRecoveryService.initialize(signer);
    } catch (error) {
      console.error("[LPManager] Error initializing service:", error);
      notify.error("Error", "Error initializing service: " + error.message);
    }
  };

  const searchUserLPs = async (targetAddress = null) => {
    const addressToSearch = targetAddress || searchAddress || address;
    
    if (!addressToSearch || !ethers.isAddress(addressToSearch)) {
      notify.error("Error", "Invalid address");
      return;
    }

    setLoading(true);
    setUserLPs([]);
    setSelectedLPs(new Set());

    try {
      await initializeService();
      const lps = await lpRecoveryService.getUserLPs(addressToSearch);
      setUserLPs(lps);
      
      if (lps.length === 0) {
        notify.info("Info", "No LP found for this address", 3000);
      }
    } catch (error) {
      console.error("[LPManager] Error searching LPs:", error);
      notify.error("Error", "Error searching LPs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLPSelection = (index) => {
    const newSelected = new Set(selectedLPs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedLPs(newSelected);
  };

  const selectAllLPs = () => {
    if (selectedLPs.size === userLPs.length) {
      setSelectedLPs(new Set());
    } else {
      setSelectedLPs(new Set(userLPs.map((_, index) => index)));
    }
  };

  const removeSingleLP = async (lpData, index) => {
    if (!isConnected) {
      notify.error("Error", "Connect your wallet first");
      return;
    }

    setProcessing(true);
    try {
      await initializeService();
      await lpRecoveryService.removeLiquidity(lpData);
      
      // Remove LP from list after success
      setUserLPs(prev => prev.filter((_, i) => i !== index));
      setSelectedLPs(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    } catch (error) {
      console.error("[LPManager] Error removing LP:", error);
    } finally {
      setProcessing(false);
    }
  };

  const removeSelectedLPs = async () => {
    if (!isConnected) {
      notify.error("Error", "Connect your wallet first");
      return;
    }

    if (selectedLPs.size === 0) {
      notify.error("Error", "Select at least one LP");
      return;
    }

    setProcessing(true);
    try {
      await initializeService();
      const selectedLPData = Array.from(selectedLPs).map(index => userLPs[index]);
      const results = await lpRecoveryService.removeLiquidityBatch(selectedLPData);
      
      // Remove successful LPs from list
      const successfulIndices = new Set();
      results.forEach((result, i) => {
        if (result.success) {
          const originalIndex = Array.from(selectedLPs)[i];
          successfulIndices.add(originalIndex);
        }
      });
      
      setUserLPs(prev => prev.filter((_, index) => !successfulIndices.has(index)));
      setSelectedLPs(new Set());
      
    } catch (error) {
      console.error("[LPManager] Error removing LPs:", error);
    } finally {
      setProcessing(false);
    }
  };

  const formatTokenAmount = (amount, symbol, decimals = 4) => {
    const num = parseFloat(amount);
    if (num === 0) return "0";
    if (num < 0.0001) return "< 0.0001";
    return num.toFixed(decimals);
  };

  const LPCard = ({ lp, index }) => (
    <div className={`${styles.card} ${styles.lpCard}`}>
      <div className={styles.cardHeader}>
        <div className={styles.lpInfo}>
          <h3>{lp.token0.symbol}/{lp.token1.symbol}</h3>
          <span className={styles.factoryBadge}>{lp.factoryName}</span>
        </div>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={selectedLPs.has(index)}
            onChange={() => toggleLPSelection(index)}
            disabled={processing}
          />
          <span className={styles.checkmark}></span>
        </label>
      </div>
      
      <div className={styles.lpDetails}>
        <div className={styles.lpBalance}>
          <span>LP Balance: {formatTokenAmount(lp.formattedBalance)} {lp.symbol}</span>
          <span>Share: {lp.userShare.toFixed(4)}%</span>
        </div>
        
        <div className={styles.tokenAmounts}>
          <div className={styles.tokenAmount}>
            <span>{lp.token0.symbol}:</span>
            <span>{formatTokenAmount(lp.token0.formattedAmount)}</span>
          </div>
          <div className={styles.tokenAmount}>
            <span>{lp.token1.symbol}:</span>
            <span>{formatTokenAmount(lp.token1.formattedAmount)}</span>
          </div>
        </div>
        
        <div className={styles.lpActions}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => removeSingleLP(lp, index)}
            disabled={processing}
          >
            {processing ? "Removing..." : "Remove LP"}
          </button>
        </div>
      </div>
    </div>
  );

  // Show loading while AppKit is initializing
  if (!isAppKitReady) {
    return (
      <div className={styles.lpRecoveryContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Initializing wallet connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.lpRecoveryContainer}>

      {/* Search controls */}
      <div className={styles.searchSection}>
        <div className={styles.inputGroup}>
          <label>Address to search LPs:</label>
          <input
            type="text"
            placeholder="0x..."
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            className={styles.inputSearch}
          />
        </div>
        
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={() => searchUserLPs()}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search LPs"}
        </button>
      </div>

      {/* Selection controls */}
      {userLPs.length > 0 && (
        <div className={styles.selectionControls}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={selectAllLPs}
            disabled={processing}
          >
            {selectedLPs.size === userLPs.length ? "Unselect All" : "Select All"}
          </button>
          
          <span className={styles.selectionCount}>
            {selectedLPs.size} of {userLPs.length} selected
          </span>
          
          <button
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={removeSelectedLPs}
            disabled={processing || selectedLPs.size === 0}
          >
            {processing ? "Processing..." : "Remove Selected"}
          </button>
        </div>
      )}

      {/* LP List */}
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Searching LPs... This may take a few minutes</p>
        </div>
      ) : userLPs.length > 0 ? (
        <div className={styles.lpList}>
          {userLPs.map((lp, index) => (
            <LPCard key={`${lp.pairAddress}-${index}`} lp={lp} index={index} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No LP found. Use the search field above to look for LPs.</p>
          {!isConnected && (
            <button
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={() => open()}
            >
              Connect Wallet
            </button>
          )}
        </div>
      )}

      {/* Additional information */}
      <div className={styles.infoSection}>
        <h3>How it works:</h3>
        <ul>
          <li>Enter an address or use your connected wallet</li>
          <li>The system searches LPs on all supported DEXs</li>
          <li>Select the LPs you want to remove</li>
          <li>Execute individual or batch removal</li>
        </ul>
        
        <div className={styles.supportedDexs}>
          <h4>Supported DEXs:</h4>
          <div className={styles.dexList}>
            <span>ViperSwap</span>
            <span>SushiSwap</span>
            <span>DFK</span>
            <span>Defira</span>
            <span>And more...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LPRecoveryManager;