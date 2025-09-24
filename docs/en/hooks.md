# Hooks

Main hooks under `src/hooks/`.

- `useRoute({ amountIn, tokenIn, tokenOut })`: calculates/obtains best route (router + path + amountOut). May use quote services and local heuristics.
- `usePriceImpact(path, amountIn)`: estimates slippage and price impact; integrates with `calculatePriceImpact` in services.
- `useOracle()`: (optional) prices for display; may integrate with Band/Chainlink if enabled.
- `useBalances()`: reads user ERC20 balances.
- `useAggregatorContract()`: helper to instantiate aggregator contracts.
- `useTheme()`: light/dark theme.
- `useWhiteListedRouters()`: list of whitelisted routers from the contract.

Best practices:
- Keep hooks pure and with correct deps to avoid loops.
- Handle BigInt/ethers v6 properly.
