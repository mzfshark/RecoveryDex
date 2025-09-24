// src/layouts/Logo.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import styles from '../styles/Global.module.css';

const Logo = () => {
  const { theme } = useTheme();
  const [logoSrc, setLogoSrc] = useState(() => {
    // Set initial logo based on current theme
    return theme === 'dark' ? '/logo_white.png' : '/logo.png';
  });
  
  const updateLogo = useCallback(() => {
    const newLogoSrc = theme === 'dark' ? '/logo_white.png' : '/logo.png';
    setLogoSrc(newLogoSrc);
    console.log('Logo updated - Theme:', theme, 'Source:', newLogoSrc);
  }, [theme]);
  
  useEffect(() => {
    updateLogo();
  }, [updateLogo]);
  
  const logoAlt = 'RecoverySwap Logo';
  
  return (
    <Link to="/" className={styles.logoContainer}>
      <img 
        src={logoSrc} 
        alt={logoAlt}
        className={styles.logo}
        width="160"
        height="40"
        key={`logo-${theme}`} // Force re-render when theme changes
        onLoad={() => console.log('Logo loaded:', logoSrc)}
        onError={(e) => {
          console.error('Logo failed to load:', logoSrc);
          // Fallback to default logo if image fails to load
          if (logoSrc !== '/logo.png') {
            setLogoSrc('/logo.png');
          }
        }}
      />
    </Link>
  );
};

export default Logo;