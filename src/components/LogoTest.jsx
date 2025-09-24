// Test file to check logo switching
import React, { useState, useEffect } from 'react';

const LogoTest = () => {
  const [theme, setTheme] = useState('light');
  const [logoSrc, setLogoSrc] = useState('/logo.png');

  useEffect(() => {
    console.log('Theme effect triggered:', theme);
    const newLogo = theme === 'dark' ? '/logo_white.png' : '/logo.png';
    setLogoSrc(newLogo);
    console.log('Logo updated to:', newLogo);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    console.log('Toggling theme from', theme, 'to', newTheme);
    setTheme(newTheme);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Logo Test Component</h2>
      <p>Current theme: {theme}</p>
      <p>Current logo source: {logoSrc}</p>
      
      <button onClick={toggleTheme} style={{ padding: '10px 20px', margin: '10px' }}>
        Toggle Theme
      </button>
      
      <div style={{ padding: '20px', backgroundColor: theme === 'dark' ? '#333' : '#fff' }}>
        <img 
          src={logoSrc} 
          alt="Logo Test"
          style={{ height: '40px' }}
          onLoad={() => console.log('Image loaded successfully:', logoSrc)}
          onError={() => console.error('Image failed to load:', logoSrc)}
        />
      </div>
    </div>
  );
};

export default LogoTest;