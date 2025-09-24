# Contrato AggregatorV2

Contrato Solidity 0.8.18 que agrega swaps via Uniswap V2 routers whitelisted.

## Principais constantes
- MAX_HOPS = 3
- MAX_INTERMEDIATE = 2
- MAX_SLIPPAGE_BPS = 2000 (20%)
- MAX_FEE_BPS = 1000 (10%)

## Configurações e Admin
- `constructor(owner, routers[], feeBps)` — inicializa owner, adiciona routers e define taxa fixa.
- `setFeeReceiver(address)` — altera o endereço que recebe as taxas.
- `addRouter(address)` / `removeRouter(address)` — gerencia whitelist de routers.
- `setWETH(address)` — configura WETH para swaps envolvendo ETH.
- `setFeeBps(uint16)` — atualiza taxa fixa, limitada por MAX_FEE_BPS.

## Leitura
- `getRouters()` / `getRouterAt(index)` / `getRouterCount()`
- `owner()` / `feeBps()` / `feeReceiver()` / `WETH()`
- `quote(amountIn, tokenIn, tokenOut, intermediates[])` → (bestOut, bestRouter, bestPath)

## Execução de Swaps
- `swap(amountIn, tokenIn, tokenOut, intermediates, deadline)`
  - Faz quote interno, aprova router e executa `swapExactTokensForTokens` com `minOut` baseado em MAX_SLIPPAGE_BPS.
- `swapWithSlippage(amountIn, tokenIn, tokenOut, intermediates, userMaxSlippageBps, deadline)`
  - Igual ao `swap`, mas com slippage parametrizável pelo usuário (<= MAX_SLIPPAGE_BPS).
- `swapWithPath(router, path, amountIn, minOut, deadline)`
  - Usa rota e minOut definidos off-chain (mais barato em gas). Sem validação on-chain de slippage além do `minOut`.
- `swapETHForTokenWithSlippage(router, path, minOut, deadline)` — payable
  - Path deve iniciar em WETH; converte ETH->WETH, aprova e faz swap.
- `swapTokenForETHWithSlippage(router, path, amountIn, minOut, deadline)`
  - Path deve terminar em WETH; faz unwrap para ETH e transfere ao usuário.

## Eventos
- `RouterAdded`, `RouterRemoved`, `FeeReceiverUpdated`, `WETHUpdated`, `FeeBpsUpdated`, `SwapExecuted`

## Notas
- Usa OZ: Ownable, ReentrancyGuard, SafeERC20.
- Roteamento via `RouterLib` (cálculo de path 2 e 3 hops, cotações seguras com try/catch).
