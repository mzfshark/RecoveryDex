// src/hooks/useAppKitSafe.js
import { useState, useEffect } from 'react';

let appKitHooks = null;

// Try to import AppKit hooks safely
try {
  const { useAppKit, useAppKitAccount } = require('@reown/appkit/react');
  appKitHooks = { useAppKit, useAppKitAccount };
} catch (error) {
  console.warn('[AppKit] Failed to load AppKit hooks:', error.message);
}

export function useAppKitSafe() {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Small delay to ensure AppKit is initialized
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (!appKitHooks || !isReady) {
    return {
      address: null,
      isConnected: false,
      open: () => console.warn('AppKit not available'),
      isAppKitReady: false
    };
  }
  
  try {
    const { address, isConnected } = appKitHooks.useAppKitAccount();
    const { open } = appKitHooks.useAppKit();
    
    return {
      address,
      isConnected,
      open,
      isAppKitReady: true
    };
  } catch (error) {
    console.warn('[AppKit] Hook execution failed:', error.message);
    return {
      address: null,
      isConnected: false,
      open: () => console.warn('AppKit not available'),
      isAppKitReady: false
    };
  }
}