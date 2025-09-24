// src/App.jsx
import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Outlet
} from 'react-router-dom';

// Layout
import Header from '../layouts/Header';
import Footer from '../layouts/Footer';

// Context Provider
import { ContractProvider } from '../context/ContractContext';

// AppKit initialization
import { initAppKit } from '../web3/appkit';

// Notification System
import NotificationSystem, { notificationManager } from './NotificationSystem';
import { setNotificationManager } from '../services/notificationService';

// Debug utilities
import '../debug/env-check.js';

// Pages
import Home from '../pages/home';
import LiquidityPage from '../pages/LiquidityPage';
import TransactionsPage from '../pages/Transactions';
import Settings from '../pages/settings';
import AdminPage from '../pages/Admin';

const Layout = () => (
  <>
    <Header />
    <main style={{ padding: "2rem", maxWidth: "1280px", margin: "0 auto" }}>
      <Outlet />
    </main>
    <Footer />
  </>
);

const App = () => {
  // Initialize AppKit on app startup
  useEffect(() => {
    console.log('[App] Starting initialization...');
    
    // Initialize AppKit with error handling
    try {
      const result = initAppKit();
      console.log('[App] AppKit initialization result:', result ? 'Success' : 'Failed/Skipped');
    } catch (error) {
      console.error('[App] AppKit initialization error:', error);
    }
    
    // Connect notification manager to services
    setNotificationManager(notificationManager);
    
    console.log('[App] App initialization completed');
  }, []);

  return (
    <ContractProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="swap" element={<Home />} />
            <Route path="liquidity" element={<LiquidityPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="settings" element={<Settings />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </Router>
      <NotificationSystem />
    </ContractProvider>
  );
};

export default App;