// src/components/WalletConnect.jsx
import React, { useEffect, useCallback, useState } from "react";
import styles from "../styles/Global.module.css";

const WalletConnect = () => {

  return (
    <nav className={`flex itemscenter justifybetween py-4 px-md ${styles.nav || ""}`}>
        {/* Conta / Conectar */}
        <div className={styles.navItem}>
        <div className={styles.accountInfo}>
          
          
          {/* Botão do Reown AppKit */}
          <appkit-button balance="show" className={styles.connectButton} />
          

        </div>
        </div>

    
  </nav>
  );
};

export default WalletConnect;
