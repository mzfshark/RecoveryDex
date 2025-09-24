# Serviços

Serviços em `src/services/` encapsulam acesso ao contrato e utilitários.

## aggregatorService.js
- getAggregatorAddress()
- quote(amountIn, tokenIn, tokenOut, intermediates)
- quoteBestRoute(amountIn, tokenIn, tokenOut, intermediates)
- executeSwap({ signer, amountIn, tokenIn, tokenOut, intermediates, deadline })
- executeSwapWithPath({ signer, router, path, amountIn, minOut, deadline })
- executeSwapWithSlippage({ signer, amountIn, tokenIn, tokenOut, intermediates, userMaxSlippageBps, deadline })
- executeSwapETHForToken({ signer, router, path, minOut, amountInWei, deadline })
- executeSwapTokenForETH({ signer, router, path, amountIn, minOut, deadline })
- Leituras: owner, feeBps, feeReceiver, WETH, getRouters/getRouterAt/getRouterCount, constantes
- Admin: add/remove router, setFeeBps, setFeeReceiver, setWETH, transfer/renounce ownership

## approvalServices.js
- `approveIfNeeded(token, spender, signer, amount)` — aprovações condicionais para evitar erros de allowance insuficiente.

## priceImpactService.js / minOutputService.js
- Cálculos auxiliares para estimar impacto de preço e minOut exibido na UI.

## provider.js
- Define provider prioritizando a carteira (window.ethereum / AppKit) com fallback para RPC público.

## routerService.js / routeServices.js / tokenService.js
- Utilitários para nomes de routers, tokens da rota e manipulação de listas.
