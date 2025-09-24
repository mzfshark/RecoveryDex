// src/pages/Settings.jsx
import React, { useState, useEffect } from "react";
import styles from "../styles/Global.module.css";
import { FiSettings, FiToggleLeft, FiToggleRight } from "react-icons/fi";

export default function Settings() {
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [deadlineMinutes, setDeadlineMinutes] = useState(30);
  const [expertMode, setExpertMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [priceImpactWarning, setPriceImpactWarning] = useState(5.0);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('dex-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setSlippageTolerance(settings.slippageTolerance || 0.5);
        setDeadlineMinutes(settings.deadlineMinutes || 30);
        setExpertMode(settings.expertMode || false);
        setDarkMode(settings.darkMode || false);
        setSoundEnabled(settings.soundEnabled !== false);
        setPriceImpactWarning(settings.priceImpactWarning || 5.0);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  const saveSettings = () => {
    const settings = {
      slippageTolerance,
      deadlineMinutes,
      expertMode,
      darkMode,
      soundEnabled,
      priceImpactWarning
    };
    localStorage.setItem('dex-settings', JSON.stringify(settings));
  };

  useEffect(saveSettings, [slippageTolerance, deadlineMinutes, expertMode, darkMode, soundEnabled, priceImpactWarning]);

  const ToggleButton = ({ enabled, onClick, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
      <span>{label}</span>
      <button 
        onClick={onClick} 
        style={{ 
          background: 'none', 
          border: 'none', 
          cursor: 'pointer',
          fontSize: '24px',
          color: enabled ? '#4CAF50' : '#ccc'
        }}
      >
        {enabled ? <FiToggleRight /> : <FiToggleLeft />}
      </button>
    </div>
  );

  const presetSlippages = [0.1, 0.5, 1.0, 3.0];

  return (
    <div className={styles.container}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
          <FiSettings style={{ marginRight: '10px', fontSize: '24px' }} />
          <h2 className={styles.title}>Settings</h2>
        </div>

        {/* Slippage Tolerance */}
        <div style={{ marginBottom: '2rem', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Slippage Tolerance</h3>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '14px' }}>
            Your transaction will revert if the price changes unfavorably by more than this percentage.
          </p>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
            {presetSlippages.map(preset => (
              <button
                key={preset}
                onClick={() => setSlippageTolerance(preset)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  background: slippageTolerance === preset ? '#007bff' : 'white',
                  color: slippageTolerance === preset ? 'white' : 'black',
                  cursor: 'pointer'
                }}
              >
                {preset}%
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={slippageTolerance}
              onChange={(e) => setSlippageTolerance(parseFloat(e.target.value) || 0)}
              style={{
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                width: '100px'
              }}
            />
            <span>%</span>
          </div>
        </div>

        {/* Transaction Deadline */}
        <div style={{ marginBottom: '2rem', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Transaction Deadline</h3>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '14px' }}>
            Your transaction will revert if it is pending for more than this long.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="number"
              min="1"
              max="120"
              value={deadlineMinutes}
              onChange={(e) => setDeadlineMinutes(parseInt(e.target.value) || 30)}
              style={{
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                width: '100px'
              }}
            />
            <span>minutes</span>
          </div>
        </div>

        {/* Price Impact Warning */}
        <div style={{ marginBottom: '2rem', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Price Impact Warning</h3>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '14px' }}>
            Show warning when price impact exceeds this threshold.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="number"
              min="0"
              max="20"
              step="0.1"
              value={priceImpactWarning}
              onChange={(e) => setPriceImpactWarning(parseFloat(e.target.value) || 5.0)}
              style={{
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                width: '100px'
              }}
            />
            <span>%</span>
          </div>
        </div>

        {/* Interface Preferences */}
        <div style={{ marginBottom: '2rem', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Interface</h3>
          
          <ToggleButton
            enabled={darkMode}
            onClick={() => setDarkMode(!darkMode)}
            label="Dark Mode"
          />
          
          <ToggleButton
            enabled={soundEnabled}
            onClick={() => setSoundEnabled(!soundEnabled)}
            label="Sound Effects"
          />
          
          <ToggleButton
            enabled={expertMode}
            onClick={() => setExpertMode(!expertMode)}
            label="Expert Mode"
          />
        </div>

        {/* Wallet Connection */}
        <div style={{ marginBottom: '2rem', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Wallet</h3>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '14px' }}>
            Manage your connected wallets and transaction settings.
          </p>
          
          <button
            style={{
              padding: '10px 20px',
              border: '1px solid #007bff',
              borderRadius: '4px',
              background: 'white',
              color: '#007bff',
              cursor: 'pointer',
              marginRight: '10px'
            }}
            onClick={() => {
              localStorage.removeItem('dex-settings');
              window.location.reload();
            }}
          >
            Reset to Defaults
          </button>
          
          <button
            style={{
              padding: '10px 20px',
              border: '1px solid #dc3545',
              borderRadius: '4px',
              background: '#dc3545',
              color: 'white',
              cursor: 'pointer'
            }}
            onClick={() => {
              localStorage.clear();
              alert('All settings cleared!');
            }}
          >
            Clear All Data
          </button>
        </div>

        {expertMode && (
          <div style={{ padding: '15px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginTop: '1rem' }}>
            <strong>⚠️ Expert Mode Enabled</strong>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
              Expert mode disables confirmations and warnings. Use at your own risk.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
