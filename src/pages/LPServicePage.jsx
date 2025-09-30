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
          Recupere seus tokens de liquidez de pares Uniswap V2 em todos os DEXs suportados na Harmony.
          Este serviço permite que você encontre e remova liquidez de seus LPs esquecidos ou perdidos.
        </p>
      </div>
      
      <LPRecoveryManager />
      
      <div className={styles.disclaimer}>
        <h3>⚠️ Aviso Importante:</h3>
        <ul>
          <li>Sempre verifique os endereços dos contratos antes de aprovar transações</li>
          <li>Configure um slippage adequado para evitar falhas nas transações</li>
          <li>Este serviço é experimental - use por sua própria conta e risco</li>
          <li>Guarde sempre uma cópia de segurança de suas chaves privadas</li>
          <li>Transações na blockchain são irreversíveis</li>
        </ul>
      </div>
    </div>
  );
};

export default LPServicePage;