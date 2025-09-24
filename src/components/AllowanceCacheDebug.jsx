// src/components/AllowanceCacheDebug.jsx
/**
 * Debug component for monitoring allowance cache performance
 * Only shows in development mode or when explicitly enabled
 */

import React, { useState, useEffect } from 'react';
import useAllowanceCache from '../hooks/useAllowanceCache';
import styles from '../styles/Global.module.css';

const AllowanceCacheDebug = ({ enabled = false }) => {
  const { cacheStats, getFormattedStats, clearCache } = useAllowanceCache();
  const [isVisible, setIsVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh stats every 5 seconds
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Only show in development or when explicitly enabled
  const shouldShow = enabled || import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';
  
  if (!shouldShow) return null;

  const formattedStats = getFormattedStats();

  const handleClearCache = () => {
    clearCache();
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      zIndex: 10000,
      fontSize: '12px'
    }}>
      <button
        onClick={() => setIsVisible(!isVisible)}
        style={{
          background: isVisible ? '#dc3545' : '#28a745',
          color: 'white',
          border: 'none',
          padding: '4px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '10px'
        }}
      >
        {isVisible ? 'Hide' : 'Show'} Cache Stats
      </button>

      {isVisible && (
        <div style={{
          marginTop: '5px',
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '10px',
          borderRadius: '6px',
          minWidth: '250px',
          fontFamily: 'monospace'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <h4 style={{ margin: 0, fontSize: '12px' }}>
              Allowance Cache
            </h4>
            <button
              onClick={handleClearCache}
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '2px 6px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '9px'
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ lineHeight: '1.4' }}>
            <div>📊 Active: <strong>{cacheStats.activeEntries}</strong></div>
            <div>💀 Expired: <span style={{color: '#ffc107'}}>{cacheStats.expiredEntries}</span></div>
            <div>📈 Total: {cacheStats.totalEntries}</div>
            <div>🎯 Hit Rate: <span style={{color: '#28a745'}}>{formattedStats.hitRate}</span></div>
            <div>📦 Usage: {formattedStats.usagePercent}</div>
            <div>⏱️ TTL: {formattedStats.ttlMinutes}min</div>
            <div style={{ 
              marginTop: '8px', 
              fontSize: '9px', 
              color: '#aaa',
              borderTop: '1px solid #444',
              paddingTop: '4px'
            }}>
              Max: {cacheStats.maxSize} • Auto-refresh: 5s
            </div>
          </div>

          {cacheStats.totalEntries === 0 && (
            <div style={{ 
              marginTop: '8px', 
              padding: '6px', 
              background: 'rgba(255, 193, 7, 0.2)', 
              borderRadius: '3px',
              fontSize: '10px',
              textAlign: 'center'
            }}>
              No cached allowances
            </div>
          )}

          {cacheStats.activeEntries > 0 && (
            <div style={{ 
              marginTop: '8px', 
              padding: '6px', 
              background: 'rgba(40, 167, 69, 0.2)', 
              borderRadius: '3px',
              fontSize: '10px',
              textAlign: 'center'
            }}>
              ✅ Cache is helping performance
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AllowanceCacheDebug;