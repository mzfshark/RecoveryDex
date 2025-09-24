/* useRoute.js */
import { useEffect, useState, useRef, useMemo } from "react";
// Comparação rasa simples entre três campos usados no hook
function shallowEqualRoute(a, b) {
  return (
    a?.amountIn === b?.amountIn &&
    a?.tokenIn?.address === b?.tokenIn?.address &&
    a?.tokenOut?.address === b?.tokenOut?.address
  );
}
import { getBestRoute } from "../services/routeServices";
import { WONE_ADDRESS } from "../utils/constants";
import { getProvider } from "../services/provider";
import AggregatorArtifact from "../abis/AggregatorMultiSplit.json";
import { ethers } from "ethers";
import { useContract } from "../context/ContractContext";

// Extract ABI from Hardhat artifact
const AggregatorABI = AggregatorArtifact.abi;

// Hook responsável por buscar e memorizar a melhor rota de swap
export default function useRoute({ amountIn, tokenIn, tokenOut }) {
  const [route, setRoute] = useState(null); // Armazena o resultado da rota
  const [partsInfo, setPartsInfo] = useState({ bestParts: 1, maxParts: 1, table: [] });
  const lastParams = useRef({}); // Guarda os últimos parâmetros para evitar chamadas redundantes
  const { tokenList } = useContract();
  const controllerRef = useRef(null); // AbortController para cancelar requisições

  // Memoiza intermediários para evitar re-renderizações desnecessárias
  const intermediaries = useMemo(() => (
    tokenList?.filter(
      (t) =>
        t.address &&
        t.address !== tokenIn?.address &&
        t.address !== tokenOut?.address
    ) || []
  ), [tokenList, tokenIn, tokenOut]);

  const DEBUG = import.meta.env.VITE_DEBUG_ROUTES === 'true'

  useEffect(() => {
    const next = { amountIn, tokenIn, tokenOut }; // Define os parâmetros atuais da rota
    if (DEBUG) console.log("[useRoute] input:", next);

    if (!tokenIn?.address || !tokenOut?.address) {
      // Only log warning if both tokens have been defined before (not during initial mount)
      if (DEBUG && (tokenIn && tokenOut && (!tokenIn.address || !tokenOut.address))) {
        console.warn("[useRoute] tokenIn ou tokenOut inválidos");
      }
      setRoute(null);
      return;
    }

    if (!amountIn || amountIn <= 0n) {
      if (DEBUG) console.log("[useRoute] no amount specified, clearing route");
      setRoute(null);
      return;
    }

    const addr = import.meta.env.VITE_AGGREGATOR_ADDRESS;
    if (!addr || !ethers.isAddress(addr)) {
  console.warn("[useRoute] invalid Aggregator address");
      return;
    }

    if (shallowEqualRoute(next, lastParams.current)) {
      if (DEBUG) console.log("[useRoute] parâmetros inalterados, rota não recalculada");
      return;
    }
    lastParams.current = next;

    // Cancel previous request if it exists
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    // Create new AbortController for this request
    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;

    // Add debouncing delay
    const debounceTimeout = setTimeout(async () => {
      if (signal.aborted) return;

      try {
  if (DEBUG) console.log("[useRoute] searching for route...");
        const provider = getProvider();
        if (!provider) {
          if (DEBUG) console.warn("[useRoute] provider unavailable; aborting route search");
          return;
        }
        const aggregator = new ethers.Contract(addr, AggregatorABI, provider);
        
        if (!aggregator) {
          if (DEBUG) console.warn("[useRoute] aggregator not available");
          return;
        }

        // Normaliza tokens nativos no objeto antes de enviar ao serviço
        const normalizeToken = (t) => t && (t.isNative || t.address === 'native')
          ? { ...t, address: WONE_ADDRESS }
          : t;
        // Se após normalização os endereços ficarem iguais, não há rota
        const nIn = normalizeToken(next.tokenIn);
        const nOut = normalizeToken(next.tokenOut);
        if (nIn?.address?.toLowerCase() === nOut?.address?.toLowerCase()) {
          if (DEBUG) console.warn("[useRoute] normalized tokenIn == tokenOut; skipping route");
          setRoute(null);
          return;
        }

        const data = await getBestRoute({
          ...next,
          tokenIn: nIn,
          tokenOut: nOut,
          intermediaries: intermediaries.map(normalizeToken),
          aggregator
        });
        
        if (!signal.aborted) {
          if (DEBUG) console.log("[useRoute] new route found:", data);
          setRoute(data);
        } else {
          if (DEBUG) console.log("[useRoute] call cancelled before setting route");
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          if (DEBUG) console.log("[useRoute] request was aborted");
          return;
        }
        console.error("[ROUTE ERROR] Falha ao simular rota:", err);
      }
    }, 300); // 300ms debounce

    return () => {
  if (DEBUG) console.log("[useRoute] cleanup executed, cancelling request");
      clearTimeout(debounceTimeout);
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [amountIn, tokenIn, tokenOut, tokenList, intermediaries, DEBUG]);

  // Calcular automaticamente o melhor número de partes (1..VITE_DEFAULT_PARTS)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const maxParts = Math.max(1, Number(import.meta.env.VITE_DEFAULT_PARTS || '1'));
        // Sem rota ou sem amountIn válido → reset básico
        if (!route || !amountIn || amountIn <= 0n || !Array.isArray(route.path) || route.path.length < 2) {
          if (!cancelled) setPartsInfo({ bestParts: 1, maxParts, table: [] });
          return;
        }
        // Respeita flag opcional para desligar auto
        const auto = String(import.meta.env.VITE_MULTISPLIT_AUTO || 'true').toLowerCase() !== 'false';
        if (!auto || maxParts <= 1) {
          if (!cancelled) setPartsInfo({ bestParts: 1, maxParts, table: [] });
          return;
        }
        const provider = getProvider();
        const addr = import.meta.env.VITE_AGGREGATOR_ADDRESS;
        if (!provider || !addr || !ethers.isAddress(addr)) {
          if (!cancelled) setPartsInfo({ bestParts: 1, maxParts, table: [] });
          return;
        }
        const aggregator = new ethers.Contract(addr, AggregatorABI, provider);
        const tokenInAddr = route.path[0];
        const tokenOutAddr = route.path[route.path.length - 1];
        const intermediates = route.path.slice(1, -1);

        let bestN = 1;
        let bestTotal = 0n;
        const table = [];
        for (let n = 1; n <= maxParts; n++) {
          const part = amountIn / BigInt(n);
          if (part <= 0n) break;
          try {
            const res = await aggregator.quote(part, tokenInAddr, tokenOutAddr, intermediates);
            const outPart = res?.[0] ?? 0n;
            const total = BigInt(outPart) * BigInt(n);
            table.push({ n, outPerPart: BigInt(outPart), totalOut: total });
            if (total > bestTotal) {
              bestTotal = total;
              bestN = n;
            }
          } catch (e) {
            table.push({ n, outPerPart: 0n, totalOut: 0n });
          }
        }
        if (!cancelled) setPartsInfo({ bestParts: bestN, maxParts, table });
      } catch (e) {
        if (!cancelled) setPartsInfo({ bestParts: 1, maxParts: 1, table: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [route, amountIn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  // Enriquecer rota com informações de MultiSplit (parts)
  const enriched = useMemo(() => {
    if (!route) return route;
    return {
      ...route,
      partsSuggested: partsInfo.bestParts || 1,
      partsMax: partsInfo.maxParts || 1,
      partsTable: partsInfo.table || [],
    };
  }, [route, partsInfo]);

  return enriched;
}
