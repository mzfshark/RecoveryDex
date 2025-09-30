// src/components/LPRecoveryManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import lpRecoveryService from '../services/lpRecoveryService';
import { getProvider } from '../services/provider';
import { notify } from '../services/notificationService';
import factoryData from '../factory.json';
import styles from '../styles/Global.module.css';

const LPRecoveryManager = () => {
  // Use AppKit hooks directly
  const { address, isConnected } = useAppKitAccount();
  const { open } = useAppKit();
  const [appKitReady, setAppKitReady] = useState(false);
  
  // Get supported DEXs from factory.json
  const supportedDexs = Object.keys(factoryData.UNISWAP.FACTORY);
  
  // Format DEX name for display
  const formatDexName = (dexKey) => {
    // Handle special cases
    const specialCases = {
      'DFK': 'DFK',
      'OPENX': 'OpenX',
      'ELK': 'Elk',
      'FUZZ': 'Fuzz',
      'MOCHI': 'Mochi',
      'UDEX': 'UDEX',
      'EGG': 'Egg',
      'FATEXDAO': 'FatexDAO',
      'COPYPASTA': 'CopyPasta',
      'SMUG': 'Smug',
      'LOCKSWAP': 'LockSwap',
      'WAGMIGMI': 'WagmiGMI'
    };
    
    if (specialCases[dexKey]) {
      return specialCases[dexKey];
    }
    
    // Default formatting: capitalize first letter and lowercase the rest
    return dexKey.charAt(0).toUpperCase() + dexKey.slice(1).toLowerCase();
  };
  
  // Simple AppKit ready check
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppKitReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Debug logging
  useEffect(() => {
    console.log('[LPManager] AppKit state:', { 
      appKitReady, 
      isConnected, 
      address: address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'null' 
    });
  }, [appKitReady, isConnected, address]);
  
  const [userLPs, setUserLPs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLPs, setSelectedLPs] = useState(new Set());
  const [searchAddress, setSearchAddress] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // DEX filter states
  const [selectedDexs, setSelectedDexs] = useState(new Set()); // Empty = ALL
  const [showDexFilter, setShowDexFilter] = useState(false);
  
  // Progress tracking states
  const [searchProgress, setSearchProgress] = useState({
    currentDex: '',
    currentDexIndex: 0,
    totalDexs: supportedDexs.length,
    foundLPs: 0,
    currentPair: 0,
    totalPairsInDex: 0,
    maxPairsToCheck: 100,
    pairsChecked: 0,
    isSearching: false
  });

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
    
    // Reset progress - start with optimized method (1 step)
    setSearchProgress({
      currentDex: '',
      currentDexIndex: 0,
      totalDexs: 1,
      foundLPs: 0,
      currentPair: 0,
      totalPairsInDex: 0,
      maxPairsToCheck: 0,
      pairsChecked: 0,
      isSearching: true
    });

    try {
      await initializeService();
      
      // Progress callback function
      const onProgress = (progress) => {
        setSearchProgress(prev => ({
          ...prev,
          ...progress
        }));
      };
      
      let foundLPs = [];
      
      // Try optimized Blockscout method first
      try {
        console.log('[LPManager] Using optimized Blockscout method...');
        notify.info("Searching", "Using fast Blockscout API method...", 3000);
        
        foundLPs = await lpRecoveryService.getUserLPsOptimized(addressToSearch, onProgress);
        
        if (foundLPs.length > 0) {
          notify.success("Success", `Found ${foundLPs.length} LP(s) using fast method`, 3000);
        }
        
      } catch (blockscoutError) {
        console.warn('[LPManager] Blockscout method failed, falling back to full scan:', blockscoutError);
        notify.info("Fallback", "Blockscout API unavailable, using full blockchain scan...", 5000);
        
        // Reset progress for full scan method
        const dexsToSearch = getFilteredDexs();
        setSearchProgress({
          currentDex: '',
          currentDexIndex: 0,
          totalDexs: dexsToSearch.length,
          foundLPs: 0,
          currentPair: 0,
          totalPairsInDex: 0,
          maxPairsToCheck: 100,
          pairsChecked: 0,
          isSearching: true
        });
        
        // Fallback to original method with DEX filtering
        foundLPs = await lpRecoveryService.getUserLPsWithProgress(addressToSearch, onProgress, dexsToSearch);
        
        if (foundLPs.length > 0) {
          notify.success("Success", `Found ${foundLPs.length} LP(s) using full scan`, 3000);
        }
      }
      
      setUserLPs(foundLPs);
      
      if (foundLPs.length === 0) {
        notify.info("Info", "No LP tokens found for this address", 3000);
      }
      
    } catch (error) {
      console.error("[LPManager] Error searching LPs:", error);
      notify.error("Error", `Failed to search LPs: ${error.message}`);
    } finally {
      setLoading(false);
      setSearchProgress(prev => ({ ...prev, isSearching: false }));
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
    
    // For very small numbers, show in scientific notation
    if (num > 0 && num < 0.000001) {
      return num.toExponential(3);
    }
    
    // For small but readable numbers, show more decimals
    if (num < 0.0001) {
      return num.toFixed(8).replace(/\.?0+$/, '');
    }
    
    // For larger numbers, use standard formatting
    if (num < 1) {
      return num.toFixed(6).replace(/\.?0+$/, '');
    }
    
    return num.toFixed(decimals);
  };

  // DEX filter functions
  const toggleDexSelection = (dexKey) => {
    const newSelected = new Set(selectedDexs);
    if (newSelected.has(dexKey)) {
      newSelected.delete(dexKey);
    } else {
      newSelected.add(dexKey);
    }
    setSelectedDexs(newSelected);
  };

  const selectAllDexs = () => {
    if (selectedDexs.size === supportedDexs.length) {
      setSelectedDexs(new Set()); // Clear all = ALL
    } else {
      setSelectedDexs(new Set(supportedDexs)); // Select all
    }
  };

  const clearDexSelection = () => {
    setSelectedDexs(new Set()); // Clear = ALL
  };

  const getFilteredDexs = () => {
    // If no DEX selected, return all (ALL mode)
    if (selectedDexs.size === 0) {
      return supportedDexs;
    }
    return Array.from(selectedDexs);
  };

  // DEX Filter Component
  const DexFilter = () => {
    const isAllSelected = selectedDexs.size === 0;
    const selectedCount = selectedDexs.size;

    return (
      <div className={styles.dexFilterContainer}>
        <div className={styles.filterHeader}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => setShowDexFilter(!showDexFilter)}
          >
            {showDexFilter ? '▼' : '▶'} DEX Filter 
            <span className={styles.filterBadge}>
              {isAllSelected ? 'ALL' : `${selectedCount} selected`}
            </span>
          </button>
          
          {showDexFilter && (
            <div className={styles.filterActions}>
              <button
                className={`${styles.button} ${styles.buttonSmall}`}
                onClick={selectAllDexs}
              >
                {selectedDexs.size === supportedDexs.length ? 'Clear All' : 'Select All'}
              </button>
              <button
                className={`${styles.button} ${styles.buttonSmall}`}
                onClick={clearDexSelection}
              >
                ALL
              </button>
            </div>
          )}
        </div>

        {showDexFilter && (
          <div className={styles.dexGrid}>
            {supportedDexs.map((dexKey) => (
              <label key={dexKey} className={styles.dexCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedDexs.has(dexKey)}
                  onChange={() => toggleDexSelection(dexKey)}
                />
                <span className={styles.dexCheckmark}></span>
                <span className={styles.dexName}>{formatDexName(dexKey)}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Progress Bar Component
  const ProgressBar = () => {
    const progressPercentage = searchProgress.totalDexs > 0 
      ? Math.round((searchProgress.currentDexIndex / searchProgress.totalDexs) * 100)
      : 0;
    
    // Calculate progress based on pairs actually checked vs max pairs to check (limited to 100)
    // But show the real total in the display
    const pairsToCheck = searchProgress.maxPairsToCheck || 100;
    const pairsChecked = searchProgress.pairsChecked || searchProgress.currentPair;
    const pairProgress = pairsToCheck > 0
      ? Math.round((pairsChecked / pairsToCheck) * 100)
      : 0;

    return (
      <div className={styles.progressContainer}>
        <div className={styles.progressHeader}>
          <h3>Searching for LP Tokens...</h3>
          <span className={styles.progressStats}>
            {searchProgress.foundLPs} LPs found so far
          </span>
        </div>
        
        <div className={styles.progressInfo}>
          <div className={styles.currentDex}>
            <strong>Current DEX:</strong> {formatDexName(searchProgress.currentDex)}
          </div>
          <div className={styles.progressText}>
            DEX {searchProgress.currentDexIndex} of {searchProgress.totalDexs}
            {searchProgress.totalPairsInDex > 0 && (
              <span>
                {' - Checking pair '} 
                {searchProgress.pairsChecked || searchProgress.currentPair}
                {'% of '}
                {searchProgress.totalPairsInDex || searchProgress.totalPairsInDex}
                {' pairs founded'}
                
              </span>
            )}
          </div>
        </div>

        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarLabel}>
            <span>Overall Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressBarFill}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {searchProgress.totalPairsInDex > 0 && (
          <div className={styles.progressBarContainer}>
            <div className={styles.progressBarLabel}>
              <span>{formatDexName(searchProgress.currentDex)} Progress</span>
              <span>{pairProgress}%</span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressBarFill}
                style={{ width: `${pairProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className={styles.progressNote}>
          <p>This process analyzes all pairs across {supportedDexs.length} DEXs. Please wait...</p>
        </div>
      </div>
    );
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
            <span>
              {formatTokenAmount(lp.token0.formattedAmount)}
              {parseFloat(lp.token0.formattedAmount) > 0 && parseFloat(lp.token0.formattedAmount) < 0.000001 && (
                <small style={{opacity: 0.7, fontSize: '0.8em', marginLeft: '4px'}}>
                  (raw: {lp.token0.formattedAmount})
                </small>
              )}
            </span>
          </div>
          <div className={styles.tokenAmount}>
            <span>{lp.token1.symbol}:</span>
            <span>
              {formatTokenAmount(lp.token1.formattedAmount)}
              {parseFloat(lp.token1.formattedAmount) > 0 && parseFloat(lp.token1.formattedAmount) < 0.000001 && (
                <small style={{opacity: 0.7, fontSize: '0.8em', marginLeft: '4px'}}>
                  (raw: {lp.token1.formattedAmount})
                </small>
              )}
            </span>
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
  if (!appKitReady) {
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

      {/* LP List */}
      {loading ? (
        <ProgressBar />
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

      {/* DEX Filter */}
      <DexFilter />

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



      {/* Additional information */}
      <div className={styles.infoSection}>
        <h3>How it works:</h3>
        <ul>
          <li>Enter an address or use your connected wallet</li>
          <li><strong>Fast Method:</strong> Uses Blockscout API to find LP tokens instantly</li>
          <li><strong>Fallback:</strong> Full blockchain scan if API is unavailable</li>
          <li>Select the LPs you want to remove</li>
          <li>Execute individual or batch removal</li>
        </ul>
        
        
        <div className={styles.supportedDexs}>
          <h4>
            {selectedDexs.size === 0 
              ? `All DEXs (${supportedDexs.length}):` 
              : `Selected DEXs (${selectedDexs.size} of ${supportedDexs.length}):`
            }
          </h4>
          <div className={styles.dexList}>
            {getFilteredDexs().map((dexKey) => (
              <span key={dexKey}>{formatDexName(dexKey)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LPRecoveryManager;