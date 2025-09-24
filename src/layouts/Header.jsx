// src/layouts/Header.jsx
import React from "react";
import Logo from "./Logo";
import Navigation from "../components/Navigation";
import WalletConnect from "../components/WalletConnect";
import styles from "../styles/Global.module.css";

const Header = () => (
  <header className={`${styles.header}`} >
    <div className={`${styles.headerLeft}`} >
      <Logo />
    </div>
    <div className={`${styles.headerNav}`} > <Navigation /></div>
    <div className={`${styles.headerRight}`} >
        <WalletConnect />
    </div>
  </header>
);

export default Header;
