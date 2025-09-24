// src/components/LiquidityDashboard.jsx

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../layouts/card";
import { formatUnits } from "ethers";
import { ethers } from "ethers";
import { FACTORY_ADDRESSES } from "../constants/dexFatories";
import { useContract } from "../context/ContractContext";
// import { fetchOraclePrice } from "../utils/fetchOraclePrice";
import { fetchPoolUsdPrice } from "../utils/fetchPoolPrice";
import { fetchCachedLiquidity, fetchHealth } from "../services/liquidityCacheService";
import harmonyTokenList from "../lists/harmony-tokenlist.json";
import styles from "@/styles/Global.module.css";

const FACTORY_ABI = [
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)"
];

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)"
];

export default function LiquidityDashboard() {
  const [liquidityData, setLiquidityData] = useState({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usingDemoData, setUsingDemoData] = useState(false);
  const { tokenList, provider } = useContract();
  const MAX_PAIRS_PER_DEX = Number(import.meta.env.VITE_LIQUIDITY_MAX_PAIRS || 300);
  const LIQ_DEBUG = import.meta.env.VITE_LIQUIDITY_DEBUG === '1';
  
  // Parser robusto para timestamps (Edge/mobile podem ter diferenças de fuso/formato)
  function parseTimestamp(ts) {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    // Tenta ISO direto
    let d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
    // Remove millis se houver
    if (typeof ts === 'string') {
      const cleaned = ts.replace(/\.[0-9]{1,6}Z$/, 'Z');
      d = new Date(cleaned);
      if (!isNaN(d.getTime())) return d;
      // Tenta adicionar 'Z' se faltar
      if (!/Z$/.test(cleaned)) {
        d = new Date(cleaned + 'Z');
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  }
  
  // Função helper: preserva campos enriquecidos (tokenPrice / totalUSD) ao receber atualização de cache
  function mergePreserveEnrichment(prev, incoming, { allowTotalsUpdate = true } = {}) {
    if (!incoming) return prev;
    const merged = { ...incoming };
    // Garantir que não perdemos símbolos já existentes / enriquecidos
    for (const [symbol, prevEntry] of Object.entries(prev || {})) {
      const nextEntry = merged[symbol];
      if (!nextEntry) {
        merged[symbol] = prevEntry; // mantém
        continue;
      }
      // Se não podemos atualizar totais ainda (snapshot não mais novo), preserva totals/pairs/decimals/address do anterior
      if (!allowTotalsUpdate) {
        merged[symbol] = {
          ...nextEntry,
            total: prevEntry.total,
            pairs: prevEntry.pairs,
            address: prevEntry.address || nextEntry.address,
            decimals: prevEntry.decimals || nextEntry.decimals
        };
      }
      // Guarda anti-regressão forte: se update permitir total mas valor diminui >70% sem nova timestamp, rejeita redução (possível race ou cache velho em CDN edge)
      if (allowTotalsUpdate === false && nextEntry.total < prevEntry.total * 0.3) {
        if (LIQ_DEBUG) console.warn('[LiquidityDashboard][Guard] Rejeitando regressão abrupta de total para', symbol, 'prev=', prevEntry.total, 'next=', nextEntry.total);
        merged[symbol].total = prevEntry.total;
        merged[symbol].pairs = prevEntry.pairs;
      }
      const hasPrevPrice = prevEntry.tokenPrice && prevEntry.tokenPrice > 0;
      const missingNextPrice = !nextEntry.tokenPrice || nextEntry.tokenPrice === 0;
      if (hasPrevPrice && missingNextPrice) {
        merged[symbol] = {
          ...merged[symbol],
          tokenPrice: prevEntry.tokenPrice,
          totalUSD: merged[symbol].totalUSD && merged[symbol].totalUSD > 0
            ? merged[symbol].totalUSD
            : (merged[symbol].total * prevEntry.tokenPrice)
        };
      }
    }
    return merged;
  }

  // Deve ficar antes de quaisquer returns condicionais para não quebrar a ordem dos hooks
  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return null;
    try {
      const d = new Date(lastUpdatedAt);
      const rel = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      const diffMs = Date.now() - d.getTime();
      const diffHours = Math.round(diffMs / 3600000);
      return `${d.toLocaleString()} (${diffHours === 0 ? 'agora' : rel.format(-diffHours, 'hour')})`;
    } catch {
      return new Date(lastUpdatedAt).toLocaleString();
    }
  }, [lastUpdatedAt]);

  // Helper: obter metadados do token
  const getTokenMeta = (symbol, address) => {
    const lowerAddr = address?.toLowerCase?.();
    let token = tokenList?.find?.(t => (t.address && t.address.toLowerCase?.() === lowerAddr) || (t.symbol?.toUpperCase?.() === symbol?.toUpperCase?.()));
    if (!token && harmonyTokenList?.tokens) {
      token = harmonyTokenList.tokens.find(t => t.symbol?.toUpperCase?.() === symbol?.toUpperCase?.() || t.address?.toLowerCase?.() === lowerAddr);
    }
    return token || { symbol, logoURI: null, name: symbol };
  };

  const [cacheProcessing, setCacheProcessing] = useState(false);

  useEffect(() => {
    if (!tokenList || tokenList.length === 0) {
      return; // Wait for tokenList to load
    }

    let cancelled = false;
    async function fetchLiquidity() {
      try {
        setLoading(true);
        setError(null);
        
        // 1) Tenta usar cache do servidor para resposta rápida
        const cached = await fetchCachedLiquidity();
        if (cached && cached.data) {
          // decide se podemos atualizar totais
          let allowTotalsUpdate = true;
          if (lastUpdatedAt && cached.updatedAt) {
            const prevDate = parseTimestamp(lastUpdatedAt);
            const newDate = parseTimestamp(cached.updatedAt);
            if (prevDate && newDate) {
              allowTotalsUpdate = newDate > prevDate;
            }
          }
          // se ainda estava processando e agora terminou, permitir update mesmo com mesma timestamp
          if (cacheProcessing && cached.processing === false) {
            allowTotalsUpdate = true;
          }
          if (LIQ_DEBUG) console.info('[LiquidityDashboard] merge cached allowTotalsUpdate=', allowTotalsUpdate, 'processing=', cached.processing, 'updatedAt=', cached.updatedAt);
          setLiquidityData(prev => mergePreserveEnrichment(prev, cached.data, { allowTotalsUpdate }));
          setCacheProcessing(!!cached.processing);
          if (cached.updatedAt) {
            setLastUpdatedAt(prev => {
              const prevDate = parseTimestamp(prev);
              const newDate = parseTimestamp(cached.updatedAt);
              if (!prevDate || !newDate) return cached.updatedAt;
              return newDate > prevDate ? cached.updatedAt : prev;
            });
          }
          setLoading(false);
          // se ainda estiver processando no servidor (cache parcial), agendar polling leve
          if (cached.processing) {
            const poll = async () => {
              if (cancelled) return;
              const health = await fetchHealth();
              if (health?.processing) {
                if (!cancelled) setTimeout(poll, 5000);
              } else {
                const fresh = await fetchCachedLiquidity();
                if (fresh?.data) {
                  let allowTotalsUpdateFresh = true;
                  if (lastUpdatedAt && fresh.updatedAt) {
                    const prevDate = parseTimestamp(lastUpdatedAt);
                    const newDate = parseTimestamp(fresh.updatedAt);
                    if (prevDate && newDate) allowTotalsUpdateFresh = newDate > prevDate;
                  }
                  // se antes processava e agora não, permitir mesmo sem avanço de timestamp
                  if (cacheProcessing && fresh.processing === false) {
                    allowTotalsUpdateFresh = true;
                  }
                  if (LIQ_DEBUG) console.info('[LiquidityDashboard] merge fresh allowTotalsUpdate=', allowTotalsUpdateFresh, 'processing=', fresh.processing, 'updatedAt=', fresh.updatedAt);
                  setLiquidityData(prev => mergePreserveEnrichment(prev, fresh.data, { allowTotalsUpdate: allowTotalsUpdateFresh }));
                  setCacheProcessing(!!fresh.processing);
                  if (fresh.updatedAt) {
                    setLastUpdatedAt(prev => {
                      const prevDate = parseTimestamp(prev);
                      const newDate = parseTimestamp(fresh.updatedAt);
                      if (!prevDate || !newDate) return fresh.updatedAt;
                      return newDate > prevDate ? fresh.updatedAt : prev;
                    });
                  }
                }
              }
            };
            setTimeout(poll, 3000);
          }
          // Dispara atualização em background do preço USD na UI, sem bloquear
          void (async () => {
            try {
              const rpcProvider = provider || new ethers.JsonRpcProvider(
                import.meta.env.VITE_RPC_URL_HARMONY || "https://api.harmony.one"
              );
              const enriched = { ...cached.data };
              for (const [symbol, data] of Object.entries(enriched)) {
                if (data.total > 0) {
                  try {
                    // Não sobrescrever preço se o servidor já forneceu um válido
                    if (data.tokenPrice && data.tokenPrice > 0) continue;
                    const token = tokenList.find(t => t.symbol?.toUpperCase() === symbol?.toUpperCase());
                    const price = await fetchPoolUsdPrice(rpcProvider, token, tokenList);
                    if (price && price > 0) {
                      data.tokenPrice = price;
                      data.totalUSD = data.total * price;
                    }
                  } catch (e) {
                    // ignora
                  }
                }
              }
              // enriquecimento nunca deve sobrescrever totals
              setLiquidityData(prev => mergePreserveEnrichment(prev, enriched, { allowTotalsUpdate: false }));
              if (LIQ_DEBUG) console.info('[LiquidityDashboard] enrichment applied');
            } catch {
              // Ignore price calculation errors
            }
          })();
          return; // evita escaneamento pesado no cliente
        }

        // 1.b) API indisponível: não usar fallback local — exibir indisponibilidade
        if (!cached) {
          if (!cancelled) {
            setLiquidityData({});
            setError('Unavailable data — try later');
            setLoading(false);
          }
          return;
        }

        // 2) Sem cache: fallback ao fluxo existente (mantém demo mode e varredura limitada)
        const rpcProvider = provider || new ethers.JsonRpcProvider(
          import.meta.env.VITE_RPC_URL_HARMONY || "https://api.harmony.one"
        );

        const result = {};

        // Initialize result for each token in tokenList
        for (const token of tokenList) {
          if (token.address && !token.isNative) { // Skip native token for liquidity pools
            result[token.symbol] = { 
              total: 0, 
              pairs: 0, 
              totalUSD: 0,
              tokenPrice: 0,
              address: token.address,
              decimals: token.decimals
            };
          }
        }

        // Attempt to fetch real data, but fallback to demo data if blocked
        let useMockData = false;
        
        try {
          // Test connectivity first
          await rpcProvider.getNetwork();
        } catch (connectError) {
          console.warn("[LiquidityDashboard] RPC connection failed, using demo data:", connectError.message);
          useMockData = true;
          setUsingDemoData(true);
        }

        if (useMockData) {
          // RPC connection failed — set an error so the UI shows that live data is unavailable.
          setError('RPC connection failed — live liquidity data is unavailable');
          setUsingDemoData(false);
        } else {
          // Real data fetching logic (kept for when RPC is available)
          for (const dex of FACTORY_ADDRESSES) {
            try {
              const factory = new ethers.Contract(dex.address, FACTORY_ABI, rpcProvider);
              const totalPairsBI = await factory.allPairsLength();
              const totalPairsNum = Number(totalPairsBI);
              const scanCount = Math.min(totalPairsNum, MAX_PAIRS_PER_DEX);

              console.log(`[LiquidityDashboard] Scanning ${dex.name} with ${scanCount}/${totalPairsNum} pairs`);

              // Scan pairs in smaller batches to avoid rate limiting
              const batchSize = 50;
              for (let start = 0; start < scanCount; start += batchSize) {
                if (cancelled) break;
                const end = Math.min(start + batchSize, scanCount);
                
                for (let i = start; i < end; i++) {
                  try {
                    const pairAddress = await factory.allPairs(i);
                    const pair = new ethers.Contract(pairAddress, PAIR_ABI, rpcProvider);

                    const [token0, token1] = await Promise.all([
                      pair.token0(), 
                      pair.token1()
                    ]);

                    // Find matching token from our tokenList
                    const matchToken = tokenList.find(t => 
                      t.address && 
                      !t.isNative &&
                      (t.address.toLowerCase() === token0.toLowerCase() || 
                       t.address.toLowerCase() === token1.toLowerCase())
                    );

                    if (matchToken && result[matchToken.symbol]) {
                      const [reserve0, reserve1] = await pair.getReserves();
                      const isToken0 = matchToken.address.toLowerCase() === token0.toLowerCase();
                      const amount = isToken0 ? reserve0 : reserve1;

                      const tokenAmount = Number(formatUnits(amount, matchToken.decimals));
                      result[matchToken.symbol].total += tokenAmount;
                      result[matchToken.symbol].pairs += 1;
                      // Atualização incremental para manter a UI responsiva
                      if (!cancelled && (i + 1) % batchSize === 0) {
                        setLiquidityData({ ...result });
                      }
                    }
                  } catch (pairError) {
                    // Skip individual pair errors
                    console.warn(`[LiquidityDashboard] Error scanning pair ${i}:`, pairError.message);
                    continue;
                  }
                }
              }
            } catch (dexError) {
              console.warn(`[LiquidityDashboard] Error scanning ${dex.name}:`, dexError.message);
              continue;
            }
          }

          // Fetch USD prices for tokens with liquidity
          for (const [symbol, data] of Object.entries(result)) {
            if (data.total > 0) {
              try {
                // Get USD price from pools
                const token = tokenList.find(t => t.symbol?.toUpperCase() === symbol?.toUpperCase());
                const price = await fetchPoolUsdPrice(rpcProvider, token, tokenList);
                if (price && price > 0) {
                  data.tokenPrice = price;
                  data.totalUSD = data.total * price;
                }
              } catch (priceError) {
                console.warn(`[LiquidityDashboard] Error fetching price for ${symbol}:`, priceError.message);
                // Set price to 0 if unavailable
                data.tokenPrice = 0;
                data.totalUSD = 0;
              }
            }
          }
        }

        if (!cancelled) setLiquidityData(result);
      } catch (err) {
        console.error("[LiquidityDashboard] Error fetching liquidity:", err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLiquidity();
    return () => {
      // interrompe atualizações se o componente desmontar
      cancelled = true;
    };
  }, [tokenList, provider, MAX_PAIRS_PER_DEX]);

  if (!tokenList || tokenList.length === 0) {
    return (
      <div className={styles.pagePadding}>
        <p className={styles.mutedText}>Loading token list...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pagePadding}>
        <p style={{ color: '#ef4444' }}>Error loading liquidity data: {error}</p>
        <button onClick={() => window.location.reload()} className={styles.mtSM} style={{ background: 'var(--primary)', color: 'var(--txt-bt-white)', border: 0, borderRadius: 8, padding: '8px 16px' }}>Retry</button>
      </div>
    );
  }

  // moved above to keep hooks' order stable

  return (
    <div className={styles.pagePadding}>
      {lastUpdatedAt && (
        <div className="mb-3">
          <span className={`${styles.textxs} ${styles.mutedText}`}>Last updated: {lastUpdatedLabel}</span>
        </div>
      )}
      {usingDemoData && (
        <div className={styles.mbLG}>
          <div className={`${styles.flex} ${styles.itemscenter} ${styles.gapSM}`}>
            <div className="w-4 h-4" style={{ background: 'var(--primary)', borderRadius: 9999 }}></div>
            <p className={styles.textsm} style={{ color: 'var(--primary)' }}>
              <strong>Demo Mode:</strong> Displaying sample liquidity data for demonstration purposes.
            </p>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className={`${styles.center} ${styles.flexcol}`} style={{ padding: '2rem 0' }}>
          <span className={styles.spinner} />
          <p className={`${styles.mutedText} ${styles.mbSM}`}>Loading liquidity data...</p>
        </div>
      ) : (
        <div className={styles.liquidityTable}>
          <div className={styles.cardGrid}>
          {Object.entries(liquidityData)
            .filter(([, data]) => data.total > 0) // Only show tokens with liquidity
            .sort(([, a], [, b]) => b.totalUSD - a.totalUSD) // Sort by USD value descending
            .map(([symbol, data]) => (
            <Card key={symbol}>
              <CardContent>
                {(() => {
                  const meta = getTokenMeta(symbol, data.address);
                  const logo = meta.logoURI || "/logo.png";
                  const name = meta.name || symbol;
                  return (
                    <div className={`${styles.liquidityCardHeader} ${styles.flex} ${styles.itemscenter} ${styles.justifybetween}`}>
                      <div className={`${styles.flex} ${styles.itemscenter} ${styles.gapSM}`}>
                        <img src={logo} alt={`${symbol} logo`} className={styles.tokenLogo} onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                        <div>
                          <h2 className={`${styles.textxs} ${styles.mutedText}`}>{name}</h2>
                        </div>
                      </div>
                      <span className={styles.pill}>{data.pairs} pairs</span>
                    </div>
                  );
                })()}

                <div className={styles.liquidityData}>
                  <div>
                    <p className={`${styles.textxs} ${styles.mutedText}`}>Total Liquidity</p>
                    <p className={`${styles.textxl} ${styles.fontbold}`}>
                      {data.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {symbol}
                    </p>
                  </div>
                  <div />
                  <div className={styles.dividerVertical}>
                    <div>
                      <p className={`${styles.textxs} ${styles.mutedText}`}>USD Value</p>
                      <p className={`${styles.textxl} ${styles.fontbold}`} style={{ color: data.totalUSD > 0 ? '#16a34a' : 'var(--muted)' }}>
                        {data.totalUSD > 0 ? `$${data.totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </p>
                    </div>

                    <div>
                      <p className={`${styles.textxs} ${styles.mutedText}`}>Token Price</p>
                      <p className={styles.textsm}>
                        {data.tokenPrice > 0 ? `$${data.tokenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={styles.liquidityData}>

                  <div>
                    <p className={`${styles.textxs} ${styles.mutedText}`}>Address</p>
                    <p className={`${styles.textxs} ${styles.truncate}`} title={data.address}>
                      {data.address || '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
      )}
      
      {!loading && Object.keys(liquidityData).length === 0 && (
        <div className={`${styles.center} ${styles.flexcol}`} style={{ padding: '2rem 0' }}>
          <p className={styles.mutedText}>No liquidity data found.</p>
        </div>
      )}
    </div>
  );
}
