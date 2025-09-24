// src/pages/Home.jsx
import React from "react";
import SwapForm from "../layouts/SwapForm";
import styles from "../styles/Global.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <SwapForm />
    </div>
  );
}
