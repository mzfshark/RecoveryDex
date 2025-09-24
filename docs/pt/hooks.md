# Hooks

Principais hooks em `src/hooks/`.

- `useRoute({ amountIn, tokenIn, tokenOut })`: calcula/obtém melhor rota (router + path + amountOut). Pode usar serviços de quote e heurísticas locais.
- `usePriceImpact(path, amountIn)`: estima slippage e impacto de preço; integra com `calculatePriceImpact` em serviços.
- `useOracle()`: (opcional) preços para exibição; pode integrar com Band/Chainlink se habilitado.
- `useBalances()`: leitura de saldos ERC20 do usuário.
- `useAggregatorContract()`: helper para instanciar contratos do agregador.
- `useTheme()`: tema claro/escuro.
- `useWhiteListedRouters()`: lista de routers whitelisted a partir do contrato.

Boas práticas:
- Manter hooks puros e com dependências corretas para evitar loops.
- Tratar BigInt/ethers v6 adequadamente.
