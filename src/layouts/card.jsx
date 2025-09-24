// src/layouts/card.jsx
import React from "react";
import styles from "../styles/Global.module.css";

export function Card({ children, className = "" }) {
  return (
    <div className={`${styles.liquidityCard} ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }) {
  return (
    <div className={`${styles.liquidityCardBox} ${className}`}>
      {children}
    </div>
  );
}
