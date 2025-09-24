# AggregatorMultiSplit Contract

Solidity 0.8.18 contract that aggregates swaps via whitelisted Uniswap V2 routers with advanced multi-split functionality for large order optimization.

## Key Constants
- MAX_HOPS = 4 (increased from 3 for better routing)
- MAX_INTERMEDIATE = 2
- MAX_PARTS = 10 (maximum splits for gas safety)
- MAX_FEE_BPS = 1000 (10%)

## Configuration and Admin
- `constructor(owner, weth, routers[], intermediates[], feeBps)` — initializes with whitelisted routers and intermediate tokens.
- `setFeeReceiver(address)` — changes the address that receives fees.
- `addRouter(address)` / `removeRouter(address)` — manages router whitelist using EnumerableSet.
- `addIntermediate(address)` / `removeIntermediate(address)` — manages whitelisted intermediate tokens (JEWEL, SONIC, VIPER, etc.).
- `setWETH(address)` — sets WETH for swaps involving ETH.
- `setFeeBps(uint16)` — updates fixed fee, limited by MAX_FEE_BPS.

## Reads
- `getRouters()` — returns array of all whitelisted routers
- `getIntermediates()` — returns array of all allowed intermediate tokens
- `owner()` / `feeBps()` / `feeReceiver()` / `WETH()` — configuration getters
- `quote(amountIn, tokenIn, tokenOut, extraIntermediates[])` → (bestOut, bestRouter, bestPath)
  - Finds optimal route across all routers using both whitelisted and extra intermediates
  - Tests direct paths, 1-hop, and 2-hop routes for maximum efficiency

## Multi-Split Swap Execution

### Core Multi-Split Functions
- `swapMultiSplit(amountIn, tokenIn, tokenOut, extraIntermediates, parts, deadline)`
  - **Key Innovation**: Divides large orders into multiple smaller swaps to reduce slippage
  - Pulls total `amountIn` once, then executes `parts` number of smaller swaps
  - Each part finds its own optimal route independently for maximum efficiency
  - Uses 2% default slippage protection per part
  - Returns net output after fees

### Native Token Support
- `swapMultiSplitNative(tokenOut, extraIntermediates, parts, deadline)` — payable
  - **Input**: Native ONE token (Harmony network)
  - Automatically wraps ONE → WETH for internal processing
  - If `tokenOut = address(0)`, unwraps back to native ONE for output
  - Seamless native token experience

- `swapMultiSplitToNative(amountIn, tokenIn, extraIntermediates, parts, deadline)`
  - **Output**: Native ONE token
  - Takes any ERC20 input, swaps to WETH, then unwraps to native ONE
  - Single transaction for complete ERC20 → Native conversion

### Advanced Routing Algorithm
- **Multi-Router Optimization**: Tests all whitelisted routers for each split
- **Dynamic Path Discovery**: 
  - Direct routes (tokenIn → tokenOut)
  - 1-hop routes (tokenIn → intermediate → tokenOut)
  - 2-hop routes (tokenIn → intermediate1 → intermediate2 → tokenOut)
- **Intermediate Token Strategy**: Uses both whitelisted tokens (JEWEL, SONIC, VIPER) and user-provided extras

## Gas Optimization & Safety
- **Split Limits**: Maximum 10 parts per transaction to prevent gas limit issues
- **Batch Approval**: Optimized approval pattern per router per split
- **Safe Quoting**: Try/catch pattern prevents reverting on invalid routes
- **Reentrancy Protection**: Full ReentrancyGuard implementation

## Fee Structure
- **Default Fee**: 0.25% (25 basis points)
- **Fee Calculation**: Applied to total output after all splits complete
- **Fee Distribution**: Automatically sent to `feeReceiver` address
- **Transparent Accounting**: Fees deducted from user's final output

## Events
- `RouterAdded`, `RouterRemoved` — Router whitelist management
- `IntermediateAdded`, `IntermediateRemoved` — Intermediate token management
- `FeeReceiverUpdated`, `WETHUpdated`, `FeeBpsUpdated` — Configuration updates
- `SwapExecuted(user, router, path, amountIn, amountOut, slippageBps, feeAmount)` — Detailed swap logging

## Technical Architecture
- **Dependencies**: OpenZeppelin (Ownable, ReentrancyGuard, SafeERC20, EnumerableSet)
- **Router Library**: Enhanced `RouterLib` with 4-hop path calculation and safe quoting
- **Network Target**: Optimized for Harmony blockchain (WONE as native token)
- **Upgradability**: Non-upgradeable design for maximum security and trust

## Benefits of Multi-Split Approach
1. **Reduced Slippage**: Large orders divided into smaller parts experience less price impact
2. **Better Price Discovery**: Each split finds its own optimal route
3. **Router Diversification**: Can use different routers for different parts of the same order
4. **MEV Resistance**: Smaller individual transactions are less attractive to MEV bots
5. **Liquidity Efficiency**: Better utilization of available liquidity across multiple pools
