# Architecture

High-level view of RecoverySwap's main modules and flows.

## Overview
- React frontend (Vite) integrated with Reown AppKit for wallet connections.
- Web3 services encapsulate calls to the `AggregatorMultiSplit` contract (ethers v6).
- The `AggregatorMultiSplit` contract provides advanced multi-split swap functionality with whitelisted routers, intermediate tokens, and optimized routing for large orders.

## Execution Flow (Multi-Split Swap)
1. UI collects user input (tokenIn, tokenOut, amount, split parts).
2. Service calls `quote(amountIn, tokenIn, tokenOut, extraIntermediates)` to get optimal route/estimated output.
3. UI displays route, impact (slippage/fee), estimated minOut, and split strategy.
4. User confirms swap execution:
   - **Standard Multi-Split**: `swapMultiSplit(amountIn, tokenIn, tokenOut, extraIntermediates, parts, deadline)`
   - **Native Input**: `swapMultiSplitNative(tokenOut, extraIntermediates, parts, deadline)` (payable)
   - **Native Output**: `swapMultiSplitToNative(amountIn, tokenIn, extraIntermediates, parts, deadline)`
5. Contract divides order into parts, finds optimal route for each part, executes swaps across multiple routers/paths, applies fees, and transfers net output to user.

## Modules
- `src/context/ContractContext.jsx`: initializes provider/signers and contracts (read/write).
- `src/services/aggregatorService.js`: quote/swap/admin functions supporting multi-split operations.
- `src/services/approvalServices.js`: conditional ERC20 approvals with allowance caching.
- `src/hooks/`: route calculation, price impact, multi-split optimization, oracles (when applicable).
- `contracts/AggregatorMultiSplit.sol`: advanced routing with multi-split functionality, intermediate token management, and native token support.

## Reown AppKit
- `src/web3/appkit.js`: configures `createAppKit` + Ethers adapter with the Harmony network.
- Hooks `useAppKitAccount`/`useAppKitProvider` feed the `ContractContext`.

## Limits and Security
- MAX_HOPS = 4; MAX_INTERMEDIATE = 2; MAX_PARTS = 10 (gas safety).
- feeBps <= MAX_FEE_BPS (cap 10%); default 0.25%.
- Routers must be whitelisted by owner using EnumerableSet.
- Intermediate tokens (JEWEL, SONIC, VIPER) whitelisted for routing optimization.
- 2% default slippage protection per split; `deadline` used to avoid MEV/excessive delays.
- Full reentrancy protection and safe quoting with try/catch patterns.
