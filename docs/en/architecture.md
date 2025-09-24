# Architecture

High-level view of RecoveryDex's main modules and flows.

## Overview
- React frontend (Vite) integrated with Reown AppKit for wallet connections.
- Web3 services encapsulate calls to the `AggregatorV2` contract (ethers v6).
- The `AggregatorV2` contract concentrates Uniswap V2 routing logic with path, slippage, and fixed fee (feeBps).

## Execution Flow (Swap)
1. UI collects user input (tokenIn, tokenOut, amount).
2. Service calls `quoteBestRoute(amountIn, tokenIn, tokenOut, intermediates)` to get route/estimated output.
3. UI displays route, impact (slippage/fee), estimated minOut.
4. User confirms:
   - With path defined: `swapWithPath(router, path, amountIn, minOut, deadline)`.
   - Without explicit path: `swap(amountIn, tokenIn, tokenOut, intermediates, deadline)` performs on-chain quote and executes.
5. Contract performs temporary approve, executes swap on the router, applies fee, then transfers tokens to the user.

## Modules
- `src/context/ContractContext.jsx`: initializes provider/signers and contracts (read/write).
- `src/services/aggregatorService.js`: quote/swap/admin and reads from the contract.
- `src/services/approvalServices.js`: conditional ERC20 approvals.
- `src/hooks/`: route calculation, price impact, oracles (when applicable).
- `contracts/AggregatorV2.sol`: routing, slippage, WETH/ETH, router and fee administration.

## Reown AppKit
- `src/web3/appkit.js`: configures `createAppKit` + Ethers adapter with the Harmony network.
- Hooks `useAppKitAccount`/`useAppKitProvider` feed the `ContractContext`.

## Limits and Security
- MAX_HOPS = 3; MAX_INTERMEDIATE = 2; MAX_SLIPPAGE_BPS = 2000.
- feeBps <= MAX_FEE_BPS (cap 10%).
- Routers must be whitelisted by the owner.
- `deadline` used to avoid MEV/excessive delays.
