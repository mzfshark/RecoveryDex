// src/components/WalletConnect.jsx
import React, { useEffect, useCallback, useState } from "react";
import { useAppKitAccount, useAppKitModal } from '@reown/appkit/react';
import { debugAppKit } from '../web3/appkit';
import styles from "../styles/Global.module.css";

const WalletConnect = () => {
  const { address, isConnected, status } = useAppKitAccount();
  const { open } = useAppKitModal();
  const [debugInfo, setDebugInfo] = useState(null);

  // Debug information
  useEffect(() => {
    if (import.meta.env.VITE_DEBUG_ROUTES === 'true') {
      setDebugInfo(debugAppKit());
    }
  }, []);

  // Manual connect fallback
  const handleConnect = useCallback(() => {
    try {
      open();
    } catch (error) {
      console.error('[WalletConnect] Failed to open modal:', error);
      // Fallback to direct wallet connection
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.request({ method: 'eth_requestAccounts' })
          .catch(err => console.error('[WalletConnect] Direct connection failed:', err));
      }
    }
  }, [open]);

  return (
    <div className={styles.walletContainer}>
      {/* Debug info (only in development) */}
      {debugInfo && import.meta.env.DEV && (
        <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '5px' }}>
          Debug: {JSON.stringify(debugInfo, null, 2)}
        </div>
      )}

      {/* Connection status */}
      {isConnected ? (
        <div className={styles.connectedWallet}>
          <span>Connected: {address?.substring(0, 6)}...{address?.substring(-4)}</span>
          <appkit-button balance="show" className={styles.connectButton} />
        </div>
      ) : (
        <div className={styles.disconnectedWallet}>
          {/* AppKit Button */}
          <appkit-button className={styles.connectButton} />
          
          {/* Fallback button if AppKit fails */}
          <button 
            onClick={handleConnect}
            className={styles.fallbackButton}
            style={{ marginLeft: '10px', display: status === 'reconnecting' ? 'block' : 'none' }}
          >
            Connect Manually
          </button>
        </div>
      )}

      {/* Connection status indicator */}
      <div className={styles.statusIndicator}>
        Status: {status || 'unknown'}
      </div>
    </div>
  );
};

export default WalletConnect;
