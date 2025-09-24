// src/pages/Transactions
import React from "react";
import Transactions from "../components/Transactions";
import styles from "../styles/Global.module.css"; // import do CSS-module gerado

const TransactionsPage = () => (
  <div className={`${styles.container} flexcolumn gapLG`}>

    <Transactions />
  </div>
);

export default TransactionsPage;