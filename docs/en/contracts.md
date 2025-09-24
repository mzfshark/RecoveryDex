# AggregatorV2 Contract

Solidity 0.8.18 contract that aggregates swaps via whitelisted Uniswap V2 routers.

## Key constants
- MAX_HOPS = 3
- MAX_INTERMEDIATE = 2
- MAX_SLIPPAGE_BPS = 2000 (20%)
- MAX_FEE_BPS = 1000 (10%)

## Configuration and Admin
- `constructor(owner, routers[], feeBps)` — initializes owner, adds routers and sets fixed fee.
- `setFeeReceiver(address)` — changes the address that receives fees.
- `addRouter(address)` / `removeRouter(address)` — manages router whitelist.
- `setWETH(address)` — sets WETH for swaps involving ETH.
- `setFeeBps(uint16)` — updates fixed fee, limited by MAX_FEE_BPS.

## Reads
- `getRouters()` / `getRouterAt(index)` / `getRouterCount()`
- `owner()` / `feeBps()` / `feeReceiver()` / `WETH()`
- `quote(amountIn, tokenIn, tokenOut, intermediates[])` → (bestOut, bestRouter, bestPath)

## Swap Execution
- `swap(amountIn, tokenIn, tokenOut, intermediates, deadline)`
  - Performs internal quote, approves router and executes `swapExactTokensForTokens` with `minOut` based on MAX_SLIPPAGE_BPS.
- `swapWithSlippage(amountIn, tokenIn, tokenOut, intermediates, userMaxSlippageBps, deadline)`
  - Same as `swap`, but with user-configurable slippage (<= MAX_SLIPPAGE_BPS).
- `swapWithPath(router, path, amountIn, minOut, deadline)`
  - Uses off-chain defined route and minOut (cheaper gas). No on-chain slippage validation beyond `minOut`.
- `swapETHForTokenWithSlippage(router, path, minOut, deadline)` — payable
  - Path must start at WETH; converts ETH->WETH, approves, and swaps.
- `swapTokenForETHWithSlippage(router, path, amountIn, minOut, deadline)`
  - Path must end at WETH; unwraps to ETH and transfers to the user.

## Events
- `RouterAdded`, `RouterRemoved`, `FeeReceiverUpdated`, `WETHUpdated`, `FeeBpsUpdated`, `SwapExecuted`

## Notes
- Uses OZ: Ownable, ReentrancyGuard, SafeERC20.
- Routing via `RouterLib` (2 and 3 hop path calculation, safe quotes with try/catch).
