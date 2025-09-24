# Guia de Administração

Operações administrativas do AggregatorV2.

## Taxas
- `setFeeBps(uint16 newFeeBps)` — taxa fixa em bps (0–1000). Padrão sugerido: 25 (0,25%).
- `setFeeReceiver(address newReceiver)` — carteira que recebe as taxas.

## Routers
- `addRouter(address router)` — adiciona um router Uniswap V2.
- `removeRouter(address router)` — remove um router da whitelist.

## WETH
- `setWETH(address _weth)` — configura o wrapper do token nativo para swaps ETH.

## Ownership
- `transferOwnership(address newOwner)` — transfere a propriedade.
- `renounceOwnership()` — renuncia a propriedade (uso cauteloso).

Todas as chamadas requerem `signer` owner. No frontend, use funções admin do `aggregatorService.js`.
