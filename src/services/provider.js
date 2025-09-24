// src/services/provider.js
import { ethers } from "ethers";

let instance;

export function getProvider() {
  if (!instance) {
    // Preferir provider vindo do AppKit (Web3Modal)
    const maybeAppKit = typeof window !== 'undefined' && window.ethereum ? window.ethereum : null;
    const rpcURL = import.meta.env.VITE_RPC_URL_HARMONY;
    if (maybeAppKit) {
      instance = new ethers.BrowserProvider(maybeAppKit);
    } else if (rpcURL && typeof rpcURL === "string") {
      instance = new ethers.JsonRpcProvider(rpcURL);
    } else {
      console.warn("[Provider] Nenhum RPC configurado e wallet provider indisponível");
      return null; // evitar crash; chamadores devem tratar null
    }
  }
  return instance;
}
