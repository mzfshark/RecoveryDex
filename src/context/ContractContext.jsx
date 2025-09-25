// src/context/ContractContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback
} from "react";
import { ethers } from "ethers";
import AggregatorABI from "../abis/AggregatorMultiSplit.json";
import rawTokenList from "../lists/tokenList.json";
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react'
import { WONE_ADDRESS } from '../utils/constants';

export const ContractContext = createContext(null);

export const useContract = () => {
  const ctx = useContext(ContractContext);
  if (!ctx) throw new Error("useContract must be inside ContractProvider");
  return ctx;
};

export const ContractProvider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [aggregatorRead, setAggregatorRead] = useState(null);
  const [aggregatorWrite, setAggregatorWrite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokenList, setTokenList] = useState([]);

  const AGG_ADDRESS =
    import.meta.env.VITE_AGGREGATOR_ADDRESS?.toLowerCase() ||
    "0xc5d2136ef39a570dcb9df6b22c730072e9ee8fda";

  const { address, isConnected, status } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  // Fallback wallet connection function for development
  const connectWalletDirect = useCallback(async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        // The effect will pick up the connection
      } catch (err) {
        console.error('[ContractContext] Direct wallet connection failed:', err);
      }
    }
  }, []);

  const initBlockchain = useCallback(async () => {
    try {
      // Provider de leitura: usa walletProvider se disponível, senão RPC público
      let readProvider = null;
      if (walletProvider) {
        readProvider = new ethers.BrowserProvider(walletProvider);
      } else if (typeof window !== 'undefined' && window.ethereum) {
        readProvider = new ethers.BrowserProvider(window.ethereum);
      } else if (import.meta.env.VITE_RPC_URL_HARMONY) {
        readProvider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL_HARMONY);
      }

      setProvider(readProvider);

      if (readProvider) {
        const aggregatorReadInstance = new ethers.Contract(
          AGG_ADDRESS,
          AggregatorABI.abi,
          readProvider
        );
        setAggregatorRead(aggregatorReadInstance);
      }

      // Se conectado via AppKit, define account e tenta pegar signer
      // IMPORTANTE: aguardar status === 'connected' para evitar corrida com o modal do AppKit
      if (isConnected && address && status === 'connected') {
        // Definir conta imediatamente para liberar UI dependente apenas da conta
        try {
          setAccount(ethers.getAddress(address));
        } catch {
          /* empty */
        }
        let browserProvider = null;
        if (walletProvider) {
          browserProvider = new ethers.BrowserProvider(walletProvider);
        } else if (typeof window !== 'undefined' && window.ethereum) {
          browserProvider = new ethers.BrowserProvider(window.ethereum);
        } else if (readProvider && typeof readProvider.getSigner === 'function') {
          browserProvider = readProvider;
        }

        if (browserProvider) {
          try {
            // Confirma que há contas disponíveis no provider antes de getSigner
            const eip1193 = walletProvider ?? window.ethereum;
            if (eip1193?.request) {
              let accounts = [];
              try {
                accounts = await eip1193.request({ method: 'eth_accounts' });
              } catch {}
              if (!accounts || accounts.length === 0) {
                // pequeno backoff e retry único
                await new Promise(r => setTimeout(r, 500));
                try {
                  accounts = await eip1193.request({ method: 'eth_accounts' });
                } catch {}
              }
              if (!accounts || accounts.length === 0) {
                throw new Error('No accounts available yet');
              }
            }
            // Evita conflito com solicitações pendentes do MetaMask (-32002)
            const signerTmp = await browserProvider.getSigner();
            const aggregatorWriteInstance = new ethers.Contract(
              AGG_ADDRESS,
              AggregatorABI.abi,
              signerTmp
            );
            setSigner(signerTmp);
            setAggregatorWrite(aggregatorWriteInstance);
          } catch (e) {
            // Se erro for de requisição pendente, faz um retry leve
            const msg = String(e?.message || '');
            const code = e?.code;
            if (code === -32002 || msg.includes('already pending')) {
              console.warn('[ContractContext] signer pending request detected, retrying shortly...');
              setTimeout(() => {
                // reexecuta init de forma segura
                initBlockchain().catch(() => {});
              }, 1200);
            } else {
              console.warn('[ContractContext] signer unavailable yet:', e);
            }
            setSigner(null);
            setAggregatorWrite(null);
          }
        } else {
          setSigner(null);
          setAggregatorWrite(null);
        }
      } else if (typeof window !== 'undefined' && window.ethereum) {
        // Fallback: check for direct MetaMask connection when AppKit isn't connected
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const signerTmp = await browserProvider.getSigner();
            const addrStr = await signerTmp.getAddress();
            setAccount(ethers.getAddress(addrStr));

            const aggregatorWriteInstance = new ethers.Contract(
              AGG_ADDRESS,
              AggregatorABI.abi,
              signerTmp
            );
            setSigner(signerTmp);
            setAggregatorWrite(aggregatorWriteInstance);
          } else {
            setSigner(null);
            setAggregatorWrite(null);
            setAccount(null);
          }
        } catch (e) {
          console.warn('[ContractContext] Fallback wallet connection check failed:', e);
          setSigner(null);
          setAggregatorWrite(null);
          setAccount(null);
        }
      } else {
        setSigner(null);
        setAggregatorWrite(null);
        setAccount(null);
      }
    } catch (err) {
  console.error("[ContractContext] init error:", err);
    } finally {
      setLoading(false);
    }
  }, [AGG_ADDRESS, walletProvider, isConnected, address, status]);

  useEffect(() => {
    // Executa a inicialização sempre que o estado da carteira/fornecedor mudar
    initBlockchain();

    // Reage a eventos EIP-1193 para reconfigurar quando conta/rede mudar
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = () => {
        setLoading(true);
        initBlockchain().catch(() => setLoading(false));
      };
      const handleChainChanged = () => {
        setLoading(true);
        initBlockchain().catch(() => setLoading(false));
      };
      window.ethereum.on?.('accountsChanged', handleAccountsChanged);
      window.ethereum.on?.('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, [initBlockchain]);

  // Carrega token list do JSON estático e injeta o token nativo ONE
  useEffect(() => {
    try {
      const items = (rawTokenList?.items || []).find(
        (it) => it.key === 'swap' && it.value?.enabled
      );
      const list = items?.value?.tokens || [];

      const chainId = Number(import.meta.env.VITE_CHAIN_ID) || 1666600000;
      const nativeOne = {
        name: 'Harmony ONE',
        chainId,
        symbol: 'ONE',
        address: 'native', // marcador para nativo
        decimals: 18,
        logoURI: 'https://raw.githubusercontent.com/sushiswap/list/master/logos/token-logos/token/one.jpg',
        isNative: true,
      };

      // Remove WONE explícito da UI para evitar duplicidade com ONE nativo
      const noWone = list.filter(
        t => t.address?.toLowerCase?.() !== WONE_ADDRESS.toLowerCase?.() && t.symbol?.toUpperCase?.() !== 'WONE'
      );

      const hasNative = noWone.some(t => t.isNative || t.symbol?.toUpperCase?.() === 'ONE');
      const combined = hasNative ? noWone : [nativeOne, ...noWone];
      setTokenList(combined);
    } catch (e) {
  console.error('[ContractContext] tokenList load error:', e);
      setTokenList([]);
    }
  }, []);

  const value = {
    provider,
    signer,
    account,
    aggregatorRead,
    aggregatorWrite,
    loading,
    tokenList,
    connectWallet: () => {
      // Sempre delega ao AppKit para evitar condição de corrida
      const el = document.querySelector('appkit-button');
      if (el) el.click();
    }
  };

  return (
    <ContractContext.Provider value={value}>
      {children}
    </ContractContext.Provider>
  );
};

export default ContractProvider;
