# Services

Services under `src/services/` encapsulate contract access and utilities.

## aggregatorService.js
- getAggregatorAddress()
- quote(amountIn, tokenIn, tokenOut, extraIntermediates)
- **Multi-Split Functions**:
  - executeSwapMultiSplit({ signer, amountIn, tokenIn, tokenOut, extraIntermediates, parts, deadline })
  - executeSwapMultiSplitNative({ signer, tokenOut, extraIntermediates, parts, deadline, value })
  - executeSwapMultiSplitToNative({ signer, amountIn, tokenIn, extraIntermediates, parts, deadline })
- **Legacy Functions** (maintained for compatibility):
  - quoteBestRoute, executeSwap, executeSwapWithPath, executeSwapWithSlippage
  - executeSwapETHForToken, executeSwapTokenForETH
- **Reads**: owner, feeBps, feeReceiver, WETH, getRouters(), getIntermediates(), constants
- **Admin**: add/remove router, add/remove intermediate, setFeeBps, setFeeReceiver, setWETH, ownership management

## approvalServices.js
- `approveIfNeeded(token, spender, signer, amount)` — conditional approvals to avoid insufficient allowance errors.

## priceImpactService.js / minOutputService.js
- Helper calculations to estimate price impact and UI-displayed minOut.

## provider.js
- Defines provider prioritizing the wallet (window.ethereum / AppKit) with public RPC fallback.

## routerService.js / routeServices.js / tokenService.js
- Utilities for router names, route tokens, and list handling.
