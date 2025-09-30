// src/pages/LPServicePage.jsx
import React from 'react';
import LPRecoveryManager from '../components/LPRecoveryManager';
import styles from '../styles/Global.module.css';

const LPServicePage = () => {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <h1>LP Recovery Service</h1>
        <p className={styles.pageDescription}>
          Recover your liquidity tokens from Uniswap V2 pairs on all supported DEXs on Harmony.
        </p>
        <p>
          This service allows you to find and remove liquidity from your forgotten or lost LPs.
        </p>
      </div>
      
      <LPRecoveryManager />
      
      <div className={styles.disclaimer}>
        <h3>⚠️ Important Warning:</h3>
        <ul>
          <li>Always verify contract addresses before approving transactions</li>
          <li>Configure appropriate slippage to avoid transaction failures</li>
          <li>This service is experimental - use at your own risk</li>
          <li>Always keep a backup copy of your private keys</li>
          <li>Blockchain transactions are irreversible</li>
        </ul>
      </div>
    </div>
  );
};

export default LPServicePage;