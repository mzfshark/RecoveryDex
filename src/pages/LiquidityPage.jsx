// src/pages/LiquidityPage.jsx
import LiquidityDashboard from "../components/LiquidityDashboard";
import styles from "../styles/Global.module.css"; // import do CSS-module gerado

export default function LiquidityPage() {
  return (
    <div className={styles.liquidityContainer}>
      <div className={styles.liquidityHeader}>
        <h1>
          Liquidity Monitoring
        </h1>
        <p >
          Monitor liquidity across DEX pools for tokens in the ecosystem
        </p>
      </div>
      <LiquidityDashboard />
    </div>
  );
}
