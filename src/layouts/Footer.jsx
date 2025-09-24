import React from 'react';
import {  FaGithub } from 'react-icons/fa';
import styles from "../styles/Global.module.css";
import Navigation from "../components/Navigation";
import ThemeToggle from "../components/ThemeToggle";

const Footer = () => {
  return (
    <footer className={`${styles.footer} gapSM`}>
      <div className={styles.credits}>
      <div className={styles.textsm}>
      <a href="https://t.me/thinkincoin" target="_blank" rel="noopener noreferrer" className={`${styles.textsm} hover:underline`}>
        Build by Think in Coin
      </a>
      </div>

      <div className={`${styles.socialIcons} `}>
        <a href="https://github.com/thinkincoin" target="_blank" rel="noopener noreferrer"><FaGithub /></a>
      </div>
      <ThemeToggle /> 
      </div>
      <div className={`${styles.mobileNav}`} > <Navigation /></div>
    </footer>
  );
};

export default Footer;
