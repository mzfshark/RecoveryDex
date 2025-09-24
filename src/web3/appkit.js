// src/web3/appkit.js
// Reown AppKit initialization (React + Ethers)
import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'

// Harmony network configuration
const HARMONY = {
  id: 1666600000,
  chainId: 1666600000,
  name: 'Harmony Mainnet',
  nativeCurrency: {
    name: 'ONE',
    symbol: 'ONE',
    decimals: 18
  },
  rpcUrls: {
    default: { 
      http: [import.meta.env.VITE_RPC_URL_HARMONY || 'https://api.harmony.one']
    },
    public: { 
      http: [import.meta.env.VITE_RPC_URL_HARMONY || 'https://api.harmony.one']
    }
  },
  blockExplorers: {
    default: { 
      name: 'Harmony Explorer', 
      url: 'https://explorer.harmony.one' 
    }
  },
  testnet: false
}

let initialized = false
let appKit = null

export function initAppKit() {
  if (initialized) return appKit
  
  // Check for required environment variables
  const projectId = import.meta.env.VITE_REOWN_PROJECT_ID
  
  console.log('[AppKit] Environment check:', {
    projectId: projectId ? `${projectId.substring(0, 8)}...` : 'NOT SET',
    rpcUrl: import.meta.env.VITE_RPC_URL_HARMONY || 'DEFAULT',
    env: import.meta.env.MODE
  })

  if (!projectId || projectId === 'placeholder_project_id' || projectId === 'demo_project_id') {
    console.warn('[AppKit] VITE_REOWN_PROJECT_ID not set or is placeholder. Wallet functionality will be limited.')
    initialized = true
    return null
  }

  const metadata = {
    name: 'RecoverySwap',
    description: 'DEX Aggregator with Multi-Split Token Swaps',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://recoveryswap.app',
    icons: [
      typeof window !== 'undefined' 
        ? `${window.location.origin}/logo512.png` 
        : 'https://recoveryswap.app/logo512.png'
    ]
  }

  console.log('[AppKit] Initializing with config:', { 
    projectId: `${projectId.substring(0, 8)}...`,
    network: HARMONY.name,
    chainId: HARMONY.id,
    metadata: metadata.name
  })

  try {
    appKit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [HARMONY],
      defaultNetwork: HARMONY,
      projectId,
      metadata,
      features: {
        analytics: true,
        socials: false,
        email: false,
        smartSessions: false
      },
      themeMode: 'light',
      themeVariables: {
        '--w3m-font-family': 'Inter, sans-serif',
        '--w3m-accent': '#3b82f6'
      }
    })

    console.log('[AppKit] Successfully initialized!')
    initialized = true
    return appKit
    
  } catch (error) {
    console.error('[AppKit] Failed to initialize:', error)
    console.error('[AppKit] Error details:', {
      message: error.message,
      stack: error.stack?.substring(0, 200)
    })
    initialized = true
    return null
  }
}

export function getAppKit() {
  return appKit
}

// Debug function to check AppKit status
export function debugAppKit() {
  return {
    initialized,
    hasAppKit: !!appKit,
    projectId: import.meta.env.VITE_REOWN_PROJECT_ID ? 'SET' : 'NOT SET',
    network: HARMONY.name,
    chainId: HARMONY.id
  }
}

