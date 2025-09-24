// src/components/Navigation.jsx
// Manages navigation between pages using React Router

import React from "react";
import { NavLink } from "react-router-dom";
import styles from  "../styles/Global.module.css"; // ensure global CSS is loaded
import { RiTokenSwapLine } from "react-icons/ri";
import { TbTransactionBitcoin } from "react-icons/tb";
import { SiGoogledocs } from "react-icons/si";
import { MdDashboard } from "react-icons/md";

// Define your pages and labels here
const navItems = [
  { path: "/swap", icon: RiTokenSwapLine,  label: "Swap" },
  { path: "/transactions", icon: TbTransactionBitcoin, label: "Transactions"},
  { path: "/liquidity", icon: MdDashboard, label: "Liquidity" },
];

// External link for docs
const ExternalLink = ({ href, icon: Icon, label }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={styles.navItem}
  >
    <Icon className={styles.Icon} />
    <span className={styles.hidden}>{label}</span>
  </a>
);

const Navigation = () => (
  <nav className={`${styles.navbar} gapMD`}>
    {navItems.map(({ path, icon: Icon, label }) => (
      <NavLink
        key={path}
        to={path}
        end
        className={({ isActive }) =>
          `${styles.navItem} ${isActive ? styles.active : ""}`
        }
      >
        <Icon className={styles.Icon} />
        <span className={styles.hidden}>{label}</span>
      </NavLink>
    ))}
    <ExternalLink 
      href="https://docs.dex.country" 
      icon={SiGoogledocs} 
      label="Docs"
    />
  </nav>
);

export default Navigation;