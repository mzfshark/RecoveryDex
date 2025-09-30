// src/hooks/useAppKitSafe.js
import { useState, useEffect } from 'react';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';

export function useAppKitSafe() {
  const [isAppKitReady, setIsAppKitReady] = useState(false);
  
  useEffect(() => {
    // Check if we're in a browser environment and AppKit is available
    if (typeof window !== 'undefined') {
      // Small delay to ensure AppKit is properly initialized
      const timer = setTimeout(() => {
        console.log('[AppKit] Setting ready state to true');
        setIsAppKitReady(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Always try to use hooks, but handle errors gracefully
  let address = null;
  let isConnected = false;
  let open = () => console.warn('AppKit not available');
  
  try {
    const accountData = useAppKitAccount();
    const appKit = useAppKit();
    
    address = accountData.address;
    isConnected = accountData.isConnected;
    open = appKit.open;
    
    console.log('[AppKit] Hooks working, isReady:', isAppKitReady, 'isConnected:', isConnected);
  } catch (error) {
    console.warn('[AppKit] Hook execution failed:', error.message);
    // Keep default values
  }
  
  return {
    address,
    isConnected,
    open,
    isAppKitReady
  };
}