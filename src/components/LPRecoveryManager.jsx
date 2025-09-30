// src/components/LPRecoveryManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import lpRecoveryService from '../services/lpRecoveryService';
import { getProvider } from '../services/provider';
import { notify } from '../services/notificationService';
import styles from '../styles/Global.module.css';

const LPRecoveryManager = () => {
  const { address, isConnected } = useAppKitAccount();
  const { open } = useAppKit();
  
  const [userLPs, setUserLPs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLPs, setSelectedLPs] = useState(new Set());
  const [slippage, setSlippage] = useState(5);
  const [searchAddress, setSearchAddress] = useState('');
  const [processing, setProcessing] = useState(false);

  // Inicializar o serviço quando conectar
  useEffect(() => {
    if (isConnected && address) {
      initializeService();
      setSearchAddress(address);
    }
  }, [isConnected, address]);

  const initializeService = async () => {
    try {
      const provider = getProvider();
      if (!provider) {
        throw new Error("Provider não disponível");
      }
      
      let signer = null;
      if (isConnected && window.ethereum) {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await browserProvider.getSigner();
      }
      
      await lpRecoveryService.initialize(signer);
    } catch (error) {
      console.error("[LPManager] Erro ao inicializar serviço:", error);
      notify.error("Erro", "Erro ao inicializar serviço: " + error.message);
    }
  };

  const searchUserLPs = async (targetAddress = null) => {
    const addressToSearch = targetAddress || searchAddress || address;
    
    if (!addressToSearch || !ethers.isAddress(addressToSearch)) {
      notify.error("Erro", "Endereço inválido");
      return;
    }

    setLoading(true);
    setUserLPs([]);
    setSelectedLPs(new Set());

    try {
      await initializeService();
      const lps = await lpRecoveryService.getUserLPs(addressToSearch);
      setUserLPs(lps);
      
      if (lps.length === 0) {
        notify.info("Info", "Nenhum LP encontrado para este endereço", 3000);
      }
    } catch (error) {
      console.error("[LPManager] Erro ao buscar LPs:", error);
      notify.error("Erro", "Erro ao buscar LPs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLPSelection = (index) => {
    const newSelected = new Set(selectedLPs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedLPs(newSelected);
  };

  const selectAllLPs = () => {
    if (selectedLPs.size === userLPs.length) {
      setSelectedLPs(new Set());
    } else {
      setSelectedLPs(new Set(userLPs.map((_, index) => index)));
    }
  };

  const removeSingleLP = async (lpData, index) => {
    if (!isConnected) {
      notify.error("Erro", "Conecte sua carteira primeiro");
      return;
    }

    setProcessing(true);
    try {
      await initializeService();
      await lpRecoveryService.removeLiquidity(lpData, slippage);
      
      // Remover o LP da lista após sucesso
      setUserLPs(prev => prev.filter((_, i) => i !== index));
      setSelectedLPs(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    } catch (error) {
      console.error("[LPManager] Erro ao remover LP:", error);
    } finally {
      setProcessing(false);
    }
  };

  const removeSelectedLPs = async () => {
    if (!isConnected) {
      notify.error("Erro", "Conecte sua carteira primeiro");
      return;
    }

    if (selectedLPs.size === 0) {
      notify.error("Erro", "Selecione pelo menos um LP");
      return;
    }

    setProcessing(true);
    try {
      await initializeService();
      const selectedLPData = Array.from(selectedLPs).map(index => userLPs[index]);
      const results = await lpRecoveryService.removeLiquidityBatch(selectedLPData, slippage);
      
      // Remover LPs bem-sucedidos da lista
      const successfulIndices = new Set();
      results.forEach((result, i) => {
        if (result.success) {
          const originalIndex = Array.from(selectedLPs)[i];
          successfulIndices.add(originalIndex);
        }
      });
      
      setUserLPs(prev => prev.filter((_, index) => !successfulIndices.has(index)));
      setSelectedLPs(new Set());
      
    } catch (error) {
      console.error("[LPManager] Erro ao remover LPs:", error);
    } finally {
      setProcessing(false);
    }
  };

  const formatTokenAmount = (amount, symbol, decimals = 4) => {
    const num = parseFloat(amount);
    if (num === 0) return "0";
    if (num < 0.0001) return "< 0.0001";
    return num.toFixed(decimals);
  };

  const LPCard = ({ lp, index }) => (
    <div className={`${styles.card} ${styles.lpCard}`}>
      <div className={styles.cardHeader}>
        <div className={styles.lpInfo}>
          <h3>{lp.token0.symbol}/{lp.token1.symbol}</h3>
          <span className={styles.factoryBadge}>{lp.factoryName}</span>
        </div>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={selectedLPs.has(index)}
            onChange={() => toggleLPSelection(index)}
            disabled={processing}
          />
          <span className={styles.checkmark}></span>
        </label>
      </div>
      
      <div className={styles.lpDetails}>
        <div className={styles.lpBalance}>
          <span>LP Balance: {formatTokenAmount(lp.formattedBalance)} {lp.symbol}</span>
          <span>Share: {lp.userShare.toFixed(4)}%</span>
        </div>
        
        <div className={styles.tokenAmounts}>
          <div className={styles.tokenAmount}>
            <span>{lp.token0.symbol}:</span>
            <span>{formatTokenAmount(lp.token0.formattedAmount)}</span>
          </div>
          <div className={styles.tokenAmount}>
            <span>{lp.token1.symbol}:</span>
            <span>{formatTokenAmount(lp.token1.formattedAmount)}</span>
          </div>
        </div>
        
        <div className={styles.lpActions}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => removeSingleLP(lp, index)}
            disabled={processing}
          >
            {processing ? "Removendo..." : "Remover LP"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.lpRecoveryContainer}>
      <div className={styles.sectionHeader}>
        <h2>LP Recovery Service</h2>
        <p>Recupere seus tokens de liquidez de pares Uniswap V2</p>
      </div>

      {/* Controles de busca */}
      <div className={styles.searchSection}>
        <div className={styles.inputGroup}>
          <label>Endereço para buscar LPs:</label>
          <input
            type="text"
            placeholder="0x..."
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            className={styles.input}
          />
        </div>
        
        <div className={styles.inputGroup}>
          <label>Slippage (%):</label>
          <input
            type="number"
            min="0.1"
            max="50"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value) || 5)}
            className={styles.input}
          />
        </div>
        
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={() => searchUserLPs()}
          disabled={loading}
        >
          {loading ? "Buscando..." : "Buscar LPs"}
        </button>
      </div>

      {/* Controles de seleção */}
      {userLPs.length > 0 && (
        <div className={styles.selectionControls}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={selectAllLPs}
            disabled={processing}
          >
            {selectedLPs.size === userLPs.length ? "Desmarcar Todos" : "Selecionar Todos"}
          </button>
          
          <span className={styles.selectionCount}>
            {selectedLPs.size} de {userLPs.length} selecionados
          </span>
          
          <button
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={removeSelectedLPs}
            disabled={processing || selectedLPs.size === 0}
          >
            {processing ? "Processando..." : "Remover Selecionados"}
          </button>
        </div>
      )}

      {/* Lista de LPs */}
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Buscando LPs... Isso pode levar alguns minutos</p>
        </div>
      ) : userLPs.length > 0 ? (
        <div className={styles.lpList}>
          {userLPs.map((lp, index) => (
            <LPCard key={`${lp.pairAddress}-${index}`} lp={lp} index={index} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>Nenhum LP encontrado. Use o campo de busca acima para procurar LPs.</p>
          {!isConnected && (
            <button
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={() => open()}
            >
              Conectar Carteira
            </button>
          )}
        </div>
      )}

      {/* Informações adicionais */}
      <div className={styles.infoSection}>
        <h3>Como funciona:</h3>
        <ul>
          <li>Digite um endereço ou use sua carteira conectada</li>
          <li>O sistema busca LPs em todos os DEXs suportados</li>
          <li>Selecione os LPs que deseja remover</li>
          <li>Configure o slippage desejado (padrão: 5%)</li>
          <li>Execute a remoção individual ou em lote</li>
        </ul>
        
        <div className={styles.supportedDexs}>
          <h4>DEXs Suportados:</h4>
          <div className={styles.dexList}>
            <span>ViperSwap</span>
            <span>SushiSwap</span>
            <span>DFK</span>
            <span>Defira</span>
            <span>E mais...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LPRecoveryManager;