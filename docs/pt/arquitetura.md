# Arquitetura

Visão de alto nível dos módulos e fluxos principais do RecoveryDex.

## Visão Geral
- Frontend React (Vite) integrado com Reown AppKit para conexão de carteiras.
- Serviços web3 encapsulam chamadas ao contrato `AggregatorV2` (ethers v6).
- Contrato `AggregatorV2` concentra lógica de roteamento Uniswap V2 com path, slippage e taxa fixa (feeBps).

## Fluxo de Execução (Swap)
1. UI coleta input do usuário (tokenIn, tokenOut, amount).
2. Serviço chama `quoteBestRoute(amountIn, tokenIn, tokenOut, intermediates)` para obter rota/saída estimada.
3. UI exibe rota, impacto (slippage/fee), minOut estimado.
4. Usuário confirma:
   - Com path definido: `swapWithPath(router, path, amountIn, minOut, deadline)`.
   - Sem path explícito: `swap(amountIn, tokenIn, tokenOut, intermediates, deadline)` faz quote on-chain e executa.
5. Contrato faz approve temporário, executa swap no router e aplica taxa, então transfere tokens ao usuário.

## Módulos
- `src/context/ContractContext.jsx`: inicializa provider/signers e contratos (read/write).
- `src/services/aggregatorService.js`: quote/swap/admin e leituras do contrato.
- `src/services/approvalServices.js`: aprovações ERC20 condicionais.
- `src/hooks/`: cálculo de rota, impacto de preço, oráculos (quando aplicável).
- `contracts/AggregatorV2.sol`: roteamento, slippage, WETH/ETH, administração de routers e taxas.

## Reown AppKit
- `src/web3/appkit.js`: configura `createAppKit` + `WagmiAdapter` com rede Harmony.
- Hooks `useAppKitAccount`/`useAppKitProvider` abastecem o `ContractContext`.

## Limites e Segurança
- MAX_HOPS = 3; MAX_INTERMEDIATE = 2; MAX_SLIPPAGE_BPS = 2000.
- feeBps <= MAX_FEE_BPS (teto 10%).
- Routers precisam estar whitelisted pelo owner.
- `deadline` usado para evitar MEV/atrasos excessivos.
