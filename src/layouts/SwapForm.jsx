// src/layouts/SwapForm.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Contract, parseUnits, formatUnits } from "ethers";
import TokenSelector from "./TokenSelector";
import Alert from "../components/Alert";
import { notify } from "../services/notificationService";
import { useContract } from "../context/ContractContext";
import { approveIfNeeded } from "../services/approvalServices";
import { 
  executeSwapWithPath,
  executeSwapETHForToken,
  executeSwapTokenForETH,
  readRouters,
  readWETH,
  getRouterAmountsOut
} from "../services/aggregatorService";
import ERC20ABI from "../abis/ERC20ABI.json";
import useRoute from "../hooks/useRoute";
import styles from "../styles/Global.module.css";
import { FiSettings } from "react-icons/fi";
import { SiWalletconnect } from "react-icons/si";
import { calculateMinOutput } from "../services/minOutputService";
import { getRouterName } from "../services/routerService";
import { getRouteTokens } from "../services/routeServices";
import { calculatePriceImpact } from "../services/priceImpactService";
import { DEFAULT_SLIPPAGE, WONE_ADDRESS, CONTRACT_FEE_PCT } from "../utils/constants";

export default function SwapForm() {
  const { aggregatorWrite, signer, connectWallet, tokenList = [], account } = useContract();
  const [inputToken, setInputToken] = useState(null);
  const [outputToken, setOutputToken] = useState(null);
  const [amount, setAmount] = useState("");
  const [inputBalance, setInputBalance] = useState("0.0");
  const [estimatedOut, setEstimatedOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [alert, setAlert] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [slippageImpact, setSlippageImpact] = useState(0);
  const [feeImpact, setFeeImpact] = useState(0);
  const parts = useMemo(() => Number(import.meta.env?.VITE_DEFAULT_PARTS || 1), []);
  const [onchainFeePct, setOnchainFeePct] = useState(null);

  const parsedAmount = useMemo(() => {
    if (!amount || !inputToken) return 0n;
    try {
      return parseUnits(amount, inputToken.decimals);
    } catch {
      return 0n;
    }
  }, [amount, inputToken]);

  const route = useRoute({ amountIn: parsedAmount, tokenIn: inputToken, tokenOut: outputToken });

  // Auto-select default tokens when token list becomes available
  useEffect(() => {
    if (tokenList.length > 0 && (!inputToken || !outputToken)) {
      // Find preferred tokens for auto-selection
      const nativeOne = tokenList.find(t => t.isNative || t.symbol?.toUpperCase() === 'ONE');
      const usdc = tokenList.find(t => t.symbol?.toUpperCase() === 'USDC');
      const dai = tokenList.find(t => t.symbol?.toUpperCase() === 'DAI');
      const wone = tokenList.find(t => t.symbol?.toUpperCase() === 'WONE');
      
      // Set input token (prefer native ONE, then USDC, then first in list)
      if (!inputToken) {
        const defaultInput = nativeOne || usdc || wone || tokenList[0];
        if (defaultInput) {
          setInputToken(defaultInput);
        }
      }
      
      // Set output token (prefer USDC, then DAI, then second in list, avoiding same as input)
      if (!outputToken) {
        const defaultOutput = usdc || dai || tokenList.find(t => t !== inputToken) || tokenList[1];
        if (defaultOutput && defaultOutput !== inputToken) {
          setOutputToken(defaultOutput);
        }
      }
    }
  }, [tokenList, inputToken, outputToken]);

  // Compat: getBestRoute retorna { amountOut, router, path }
  const { path = [], router, amountOut: bestOut, partsSuggested = 1, partsMax = Number(import.meta.env?.VITE_DEFAULT_PARTS || 1), partsTable = [] } = route || {};

  const deadlineBI = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    return BigInt(nowSec + 1800); // +30min
  }, []);

  useEffect(() => {
    if (!signer || !inputToken) {
      setInputBalance("0.0");
      return;
    }
    (async () => {
      try {
        const addr = await signer.getAddress();
        if (inputToken.isNative || inputToken.address === 'native') {
          const raw = await signer.provider.getBalance(addr);
          setInputBalance(formatUnits(raw, 18));
        } else {
          const contract = new Contract(inputToken.address, ERC20ABI, signer);
          const raw = await contract.balanceOf(addr);
          setInputBalance(formatUnits(raw, inputToken.decimals));
        }
      } catch (e) {
        console.error("[balance fetch error]", e);
        setInputBalance("0.0");
      }
    })();
  }, [signer, inputToken]);

  // Real price impact calculation based on actual pool reserves
  useEffect(() => {
    if (path.length > 1 && parsedAmount > 0n) {
      const calculateRealPriceImpact = async () => {
        try {
          const { slippage, fee } = await calculatePriceImpact(path, parsedAmount, router);
          setSlippageImpact(slippage);
          setFeeImpact(fee);
        } catch (error) {
          console.warn("[SwapForm] Failed to calculate price impact:", error);
          // Fallback to conservative estimates
          const amountFloat = parseFloat(amount || "0");
          const fallbackImpact = Math.min(amountFloat * 0.05, 2); // More conservative than before
          setSlippageImpact(fallbackImpact);
          setFeeImpact(CONTRACT_FEE_PCT); // Use fixed contract fee
        }
      };
      calculateRealPriceImpact();
    } else {
      setSlippageImpact(0);
      setFeeImpact(0);
    }
  }, [path, parsedAmount, amount, router]);

  // Opcional: buscar feeBps on-chain para exibir no preview
  useEffect(() => {
    let mounted = true;
    import("../services/aggregatorService.js").then(async ({ readFeeBps }) => {
      try {
        const bps = await readFeeBps();
        if (!mounted) return;
        if (typeof bps === "bigint" || typeof bps === "number") {
          const pct = Number(bps) / 100; // bps -> %
          setOnchainFeePct(pct);
        }
      } catch {
        // ignore
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (bestOut && outputToken) {
      setEstimatedOut(formatUnits(bestOut, outputToken.decimals));
    } else {
      setEstimatedOut("");
    }
  }, [bestOut, outputToken]);

  const unitPrice = useMemo(() => {
    const amt = parseFloat(amount);
    const out = parseFloat(estimatedOut);
    return amt > 0 && out > 0 ? (out / amt).toFixed(6) : "";
  }, [amount, estimatedOut]);

  const minOutput = useMemo(() => {
    if (!estimatedOut) return "";
    return calculateMinOutput(parseFloat(estimatedOut), slippageImpact, feeImpact).toFixed(4);
  }, [estimatedOut, slippageImpact, feeImpact]);

  // Precise minOut in BigInt to pass to contract
  const minOutBI = useMemo(() => {
    try {
      if (!bestOut || !outputToken) return 0n;
      const totalImpactBps = BigInt(Math.max(0, Math.round((slippageImpact + feeImpact) * 100)));
      return (bestOut * (10000n - totalImpactBps)) / 10000n;
    } catch {
      return 0n;
    }
  }, [bestOut, outputToken, slippageImpact, feeImpact]);

  const handleSwap = useCallback(
    async e => {
      e.preventDefault();
      if (!(aggregatorWrite && signer && inputToken && outputToken && parsedAmount > 0n && path?.length)) {
        setAlert({ type: "error", message: "Fill all fields" });
        return;
      }
      if (isSwapping) {
        setAlert({ type: "error", message: "Swap already in progress" });
        return;
      }
      try {
        setLoading(true);
        setIsSwapping(true);
        
        // Show initial notification
        notify.info(
          "Swap Started",
          `Swapping ${amount} ${inputToken?.symbol} → ${outputToken?.symbol}`,
          3000
        );
        
        console.log("[SwapForm] Starting swap:", {
          inputToken: {
            symbol: inputToken?.symbol,
            address: inputToken?.address,
            isNative: inputToken?.isNative,
            decimals: inputToken?.decimals
          },
          outputToken: {
            symbol: outputToken?.symbol,
            address: outputToken?.address,
            isNative: outputToken?.isNative,
            decimals: outputToken?.decimals
          },
          amount,
          parsedAmount: parsedAmount.toString(),
          route: {
            path,
            router,
            partsSuggested
          },
          minOutBI: minOutBI.toString(),
          deadline: deadlineBI.toString(),
          aggregatorAddress: aggregatorWrite?.target
        });
        
        // Aggregator pre-validations
        try {
          const routers = await readRouters();
          const routerOk = Array.isArray(routers) && routers.some(r => (r || '').toLowerCase() === (router || '').toLowerCase());
          if (!routerOk) {
            throw new Error("Selected router is not enabled in Aggregator. Please enable it first.");
          }
          const aggWeth = (await readWETH()) || '';
          if (inputToken?.isNative || inputToken?.address === 'native') {
            if (aggWeth.toLowerCase() !== WONE_ADDRESS.toLowerCase()) {
              throw new Error("Aggregator WETH is not set to WONE. Please configure WETH to WONE on the contract.");
            }
          }
          if (outputToken?.isNative || outputToken?.address === 'native') {
            if (aggWeth.toLowerCase() !== WONE_ADDRESS.toLowerCase()) {
              throw new Error("Aggregator WETH is not set to WONE. Please configure WETH to WONE on the contract.");
            }
          }
        } catch (preflightErr) {
          console.warn("[SwapForm] Preflight validation error:", preflightErr);
          setAlert({ type: "error", message: preflightErr.message || "Preflight validation failed" });
          return;
        }
        // Routing with pre-calculated path; handles native correctly
        if (!router || !Array.isArray(path) || path.length < 2) {
          throw new Error("No valid route found");
        }

  let tx;
        const routePath = Array.isArray(path) ? Array.from(path) : [];
        const startsWithWone = (routePath[0] || "").toLowerCase() === WONE_ADDRESS.toLowerCase();
        const endsWithWone = (routePath[routePath.length - 1] || "").toLowerCase() === WONE_ADDRESS.toLowerCase();
        
        console.log("[SwapForm] Path analysis:", {
          inputToken: inputToken?.symbol,
          outputToken: outputToken?.symbol,
          isInputNative: inputToken.isNative || inputToken.address === 'native',
          isOutputNative: outputToken.isNative || outputToken.address === 'native',
          routePath,
          startsWithWone,
          endsWithWone,
          parsedAmount: parsedAmount.toString(),
          minOutBI: minOutBI.toString()
        });
        
        if (inputToken.isNative || inputToken.address === 'native') {
          notify.info("Swap Type", "Native ONE → Token", 2000);
          console.log("[SwapForm] Executing swap: Native ONE -> Token");
          // ONE -> Token: use payable function with msg.value
          if (minOutBI <= 0n) throw new Error("Invalid minOut");
          if (!startsWithWone) {
            throw new Error("Invalid route for native input: path must start with WONE");
          }
          try {
            const amounts = await getRouterAmountsOut(router, parsedAmount, routePath);
            const out = amounts?.[amounts.length - 1] ?? 0n;
            if (out <= 0n) throw new Error("Router returned zero output for the route");
            if (out < minOutBI) throw new Error("Slippage too high: expected output below minOut");
          } catch (probeErr) {
            throw new Error(`Route not executable on router: ${probeErr?.reason || probeErr?.message || 'unknown error'}`);
          }
          tx = await executeSwapETHForToken({
            signer,
            router,
            path: routePath,
            minOut: minOutBI,
            amountInWei: parsedAmount,
            parts: partsSuggested,
            deadline: deadlineBI,
          });
        } else if (outputToken.isNative || outputToken.address === 'native') {
          notify.info("Swap Type", "Token → Native ONE", 2000);
          console.log("[SwapForm] Executing swap: Token -> Native ONE");
          // Token -> ONE
          await approveIfNeeded(inputToken.address, aggregatorWrite.target, signer, parsedAmount);
          if (minOutBI <= 0n) throw new Error("Invalid minOut");
          if (!endsWithWone) {
            throw new Error("Invalid route for native output: path must end with WONE");
          }
          try {
            const amounts = await getRouterAmountsOut(router, parsedAmount, routePath);
            const out = amounts?.[amounts.length - 1] ?? 0n;
            if (out <= 0n) throw new Error("Router returned zero output for the route");
            if (out < minOutBI) throw new Error("Slippage too high: expected output below minOut");
          } catch (probeErr) {
            throw new Error(`Route not executable on router: ${probeErr?.reason || probeErr?.message || 'unknown error'}`);
          }
          tx = await executeSwapTokenForETH({
            signer,
            router,
            path: routePath,
            amountIn: parsedAmount,
            minOut: minOutBI,
            parts: partsSuggested,
            deadline: deadlineBI,
          });
        } else {
          notify.info("Swap Type", "Token → Token", 2000);
          console.log("[SwapForm] Executing swap: Token -> Token");
          // Token -> Token
          await approveIfNeeded(inputToken.address, aggregatorWrite.target, signer, parsedAmount);
          if (minOutBI <= 0n) throw new Error("Invalid minOut");
          try {
            const amounts = await getRouterAmountsOut(router, parsedAmount, routePath);
            const out = amounts?.[amounts.length - 1] ?? 0n;
            if (out <= 0n) throw new Error("Router returned zero output for the route");
            if (out < minOutBI) throw new Error("Slippage too high: expected output below minOut");
          } catch (probeErr) {
            throw new Error(`Route not executable on router: ${probeErr?.reason || probeErr?.message || 'unknown error'}`);
          }
          tx = await executeSwapWithPath({
            signer,
            router,
            path: routePath,
            amountIn: parsedAmount,
            minOut: minOutBI,
            parts: partsSuggested,
            deadline: deadlineBI,
          });
        }
        
        const txHashSent = tx?.hash;
        notify.info(
          "Transaction Sent", 
          txHashSent ? `Hash: ${txHashSent.slice(0, 10)}...` : "Transaction sent to network",
          4000
        );
        
        console.log("[SwapForm] Transaction sent:", {
          hash: tx?.hash,
          to: tx?.to,
          value: tx?.value?.toString(),
          data: tx?.data
        });
        
        notify.info("Processing", "Waiting for confirmation...", 3000);
        console.log("[SwapForm] Waiting for confirmation...");
        const receipt = await tx.wait();
        
        // Get transaction hash with fallbacks
        const txHash = receipt?.transactionHash || receipt?.hash || tx?.hash || 'Unknown';
        
        console.log("[SwapForm] Transaction hash debug:", {
          'receipt.transactionHash': receipt?.transactionHash,
          'receipt.hash': receipt?.hash,
          'tx.hash': tx?.hash,
          'finalTxHash': txHash
        });
        
        notify.success(
          "Swap Confirmed!",
          txHash && txHash !== 'Unknown' ? `Transaction: ${txHash.slice(0, 10)}...` : "Transaction confirmed!",
          6000
        );
        
        console.log("[SwapForm] Transaction confirmed:", {
          transactionHash: receipt?.transactionHash,
          hash: receipt?.hash,
          txHash: tx?.hash,
          finalHash: txHash,
          blockNumber: receipt?.blockNumber,
          status: receipt?.status,
          gasUsed: receipt?.gasUsed?.toString(),
          logs: receipt?.logs?.length || 0
        });
        
        // Parse logs to extract swap information
        if (receipt?.logs && receipt.logs.length > 0) {
          console.log("[SwapForm] Transaction logs:");
          receipt.logs.forEach((log, index) => {
            console.log(`  Log ${index}:`, {
              address: log.address,
              topics: log.topics,
              data: log.data
            });
          });
        }
        

        setAmount("");
        setEstimatedOut("");
      } catch (err) {
        console.error("[SwapForm] Detailed swap error:", {
          message: err?.message,
          reason: err?.reason,
          code: err?.code,
          data: err?.data,
          transaction: err?.transaction,
          receipt: err?.receipt,
          stack: err?.stack
        });
        
        let errorMessage = "Swap failed";
        
        // Parse specific errors
        if (err?.reason) {
          errorMessage = `Error: ${err.reason}`;
        } else if (err?.message) {
          if (err.message.includes("execution reverted")) {
            errorMessage = "Transaction reverted - check balance and approvals";
          } else if (err.message.includes("insufficient funds")) {
            errorMessage = "Insufficient balance for transaction";
          } else if (err.message.includes("user rejected")) {
            errorMessage = "Transaction rejected by user";
          } else {
            errorMessage = err.message;
          }
        }
        
        notify.error(
          "Swap Failed",
          errorMessage.length > 50 ? errorMessage.slice(0, 50) + "..." : errorMessage,
          7000
        );
        
        setAlert({ type: "error", message: errorMessage });
      } finally {
        setLoading(false);
        setIsSwapping(false);
      }
    },
    [aggregatorWrite, signer, inputToken, outputToken, parsedAmount, deadlineBI, path, isSwapping, minOutBI, router]
  );

  const routerName = useMemo(() => getRouterName(router), [router]);
  const routeTokens = useMemo(() => getRouteTokens(path, tokenList), [path, tokenList]);
  const gainPct = useMemo(() => {
    if (!Array.isArray(partsTable) || partsTable.length === 0) return null;
    const base = partsTable.find(r => r.n === 1)?.totalOut ?? 0n;
    const chosen = partsTable.find(r => r.n === partsSuggested)?.totalOut ?? 0n;
    if (base && chosen && chosen > base) {
      const ratio = Number(chosen - base) / Number(base);
      return (ratio * 100).toFixed(2);
    }
    return null;
  }, [partsTable, partsSuggested]);
  const intermediateTokens = useMemo(() => routeTokens.slice(1, Math.max(1, routeTokens.length - 1)), [routeTokens]);

  return (
    <div className={styles.swapBox}>
      <form className={styles.swapCard} onSubmit={handleSwap}>
        <div className={styles.swapCardTitle}>
          <h2>Swap</h2>
          <button type="button" className={styles.button} onClick={() => setShowSettings(s => !s)}>
            <FiSettings />
          </button>
        </div>
        {showSettings && (
          <div className="mt-2">
            <p>Impact: {slippageImpact.toFixed(2)}%</p>
            <p>Fee: {feeImpact.toFixed(2)}%</p>
            <p>Tolerance: {DEFAULT_SLIPPAGE}%</p>
          </div>
        )}
        <label className={styles.balanceText}>Balance: {parseFloat(inputBalance).toFixed(4)}</label>
        <div className={styles.swapCardInputs}>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.0"
            className={styles.inputField}
            disabled={!inputToken || !outputToken}
          />
          <button type="button" onClick={() => setAmount(inputBalance)} disabled={!signer || !inputBalance || inputBalance === "0.0"} className={styles.maxButton}>
            Max
          </button>
          <TokenSelector selectedToken={inputToken} onSelect={setInputToken} />
        </div>
        {unitPrice && inputToken && outputToken && (
          <p className={styles.priceDisplay}>
            1 {inputToken.symbol} ≈ {unitPrice} {outputToken.symbol}
          </p>
        )}
        <div className={styles.swapCardInputs}>
          <input type="text" value={estimatedOut} className={styles.inputField} disabled />
          <TokenSelector selectedToken={outputToken} onSelect={setOutputToken} />
        </div>
        {!account ? (
          <button type="button" onClick={connectWallet} className={styles.swapButton}>
            <SiWalletconnect /> Connect Wallet
          </button>
        ) : (
          <button type="submit" className={styles.swapButton} disabled={loading || isSwapping || !signer}>
            {isSwapping ? "Swapping..." : loading ? "Loading..." : "Swap"}
          </button>
        )}
      </form>
      {path?.length > 0 && (
        <div className={styles.swapDetailsContainer}>
          <p><strong>Engine:</strong> MultiSplit (swapMultiSplit)</p>
          <p><strong>Parts:</strong> {partsSuggested} / {partsMax} {partsSuggested > 1 ? "(auto)" : ""}</p>
          {gainPct && (
            <p><strong>Gain:</strong> {gainPct}%</p>
          )}
          <p><strong>Router (probe):</strong> {routerName}</p>
          <p><strong>Route:</strong> {routeTokens.map((t, i) => (<span key={t.address}>{i > 0 ? ' → ' : ''}{t.symbol}</span>))}</p>
          {intermediateTokens.length > 0 && (
            <p><strong>Intermediários:</strong> {intermediateTokens.map((t, i) => (
              <span key={t.address}>{i > 0 ? ', ' : ''}{t.symbol}</span>
            ))}</p>
          )}
          <p><strong>Price Impact:</strong> {slippageImpact.toFixed(2)}%</p>
          <p><strong>Fee:</strong> {onchainFeePct != null ? onchainFeePct.toFixed(2) : feeImpact.toFixed(2)}%</p>
          <p><strong>Min Output:</strong> {minOutput}</p>
        </div>
      )}
      {alert && <Alert {...alert} onClose={() => setAlert(null)} />}
    </div>
  );
}
