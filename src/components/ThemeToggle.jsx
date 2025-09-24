// src/components/ThemeToggle.jsx
import React from 'react';
import { FaMoon, FaSun } from 'react-icons/fa';
import styles from '../styles/Global.module.css';
import { useTheme } from '../hooks/useTheme';

const ThemeToggle = () => {
  const { theme, toggle } = useTheme();

  return (
    <button onClick={toggle} className={styles.button} aria-label="Toggle theme">
      {theme === 'dark' ? <FaSun /> : <FaMoon />}
    </button>
  );
};

export default ThemeToggle;
