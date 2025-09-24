// src/components/WalletConnect.jsx
import React from "react";
import styles from "../styles/Global.module.css";

const WalletConnect = () => {
  return (
    <div className={styles.walletContainer}>
      <appkit-button balance="show" className={styles.connectButton} />
    </div>
  );
};

export default WalletConnect;
