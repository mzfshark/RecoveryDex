// Simple wallet connection test component
import React, { useState, useCallback } from 'react';

const SimpleWalletTest = () => {
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('disconnected');

  const connectWallet = useCallback(async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setStatus('connecting');
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        setAccount(accounts[0]);
        setStatus('connected');
        console.log('[SimpleTest] Connected:', accounts[0]);
      } catch (error) {
        console.error('[SimpleTest] Connection failed:', error);
        setStatus('failed');
      }
    } else {
      console.error('[SimpleTest] No ethereum provider found');
      setStatus('no-provider');
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setStatus('disconnected');
  }, []);

  return (
    <div style={{ 
      padding: '10px', 
      border: '1px solid #ccc', 
      borderRadius: '5px',
      margin: '10px 0'
    }}>
      <h4>Simple Wallet Test</h4>
      <p>Status: {status}</p>
      {account && <p>Account: {account}</p>}
      
      <div>
        <button onClick={connectWallet} disabled={status === 'connecting'}>
          {status === 'connecting' ? 'Connecting...' : 'Connect MetaMask'}
        </button>
        {account && (
          <button onClick={disconnect} style={{ marginLeft: '10px' }}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
};

export default SimpleWalletTest;