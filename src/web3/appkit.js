// src/web3/appkit.js
// Reown AppKit initialization (React + Ethers)
import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'

// Harmony network (objeto simples + CAIP-2)
const HARMONY = {
  id: 1666600000,
  caipNetworkId: 'eip155:1666600000',
  chainNamespace: 'eip155',
  name: 'Harmony',
  nativeCurrency: {
    name: 'Harmony One',
    symbol: 'ONE',
    decimals: 18
  },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RPC_URL_HARMONY || 'https://api.harmony.one'] },
    public: { http: [import.meta.env.VITE_RPC_URL_HARMONY || 'https://api.harmony.one'] }
  },
  blockExplorers: {
    default: { name: 'Harmony Explorer', url: 'https://explorer.harmony.one' }
  }
}

let initialized = false
let appKitInstance = null

export function initAppKit() {
  if (initialized && appKitInstance) return appKitInstance
  // With vite --mode dev, variables from .env.dev are exposed in import.meta.env
  const projectId = import.meta.env.VITE_REOWN_PROJECT_ID
  if (!projectId || projectId === 'placeholder_project_id' || projectId === 'demo_project_id') {
    console.warn('[AppKit] VITE_REOWN_PROJECT_ID not set or is placeholder. Wallet functionality limited.')
    initialized = true
    return
  }

  console.log('[AppKit] Initializing with project ID:', projectId)

  const metadata = {
    name: 'RecoveryDex',
    description: 'DEX Aggregator with path routing and slippage control',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://dex.country',
    icons: [
      (typeof window !== 'undefined' ? `${window.location.origin}/logo512.png` : 'https://dex.country/logo512.png')
    ]
  }

  // 1) Cria o AppKit com adaptador Ethers
  try {
    appKitInstance = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [HARMONY],
      projectId,
      metadata,
      features: {
        analytics: false
      },
      enableWalletConnect: true,
      enableInjected: true,
      enableEIP6963: true
    })
  } catch (error) {
    console.error('[AppKit] Failed to initialize:', error)
    // Continue anyway - app should still work with direct wallet connection
  }

  initialized = true
  return appKitInstance
}

export function getAppKitInstance() {
  return appKitInstance
}