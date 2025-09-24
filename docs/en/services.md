# Services

Services under `src/services/` encapsulate contract access and utilities.

## aggregatorService.js
- getAggregatorAddress()
- quote(amountIn, tokenIn, tokenOut, intermediates)
- quoteBestRoute(amountIn, tokenIn, tokenOut, intermediates)
- executeSwap({ signer, amountIn, tokenIn, tokenOut, intermediates, deadline })
- executeSwapWithPath({ signer, router, path, amountIn, minOut, deadline })
- executeSwapWithSlippage({ signer, amountIn, tokenIn, tokenOut, intermediates, userMaxSlippageBps, deadline })
- executeSwapETHForToken({ signer, router, path, minOut, amountInWei, deadline })
- executeSwapTokenForETH({ signer, router, path, amountIn, minOut, deadline })
- Reads: owner, feeBps, feeReceiver, WETH, getRouters/getRouterAt/getRouterCount, constants
- Admin: add/remove router, setFeeBps, setFeeReceiver, setWETH, transfer/renounce ownership

## approvalServices.js
- `approveIfNeeded(token, spender, signer, amount)` — conditional approvals to avoid insufficient allowance errors.

## priceImpactService.js / minOutputService.js
- Helper calculations to estimate price impact and UI-displayed minOut.

## provider.js
- Defines provider prioritizing the wallet (window.ethereum / AppKit) with public RPC fallback.

## routerService.js / routeServices.js / tokenService.js
- Utilities for router names, route tokens, and list handling.
