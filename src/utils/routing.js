
/**
 * Descobre a melhor rota e router para um swap.
 *
 * @param {Object}  params
 * @param {string}  params.tokenIn        endereço do token de entrada
 * @param {string}  params.tokenOut       endereço do token de saída
 * @param {bigint}  params.amountIn       quantidade (em wei) do tokenIn
 * @param {string[]} params.intermediates lista de endereços de tokens intermediários
 * @param {string[]} params.routers       endereços de routers whitelistados
 * @param {Contract} params.aggregator    instância do Aggregator.sol (ethers v6)
 *
 * @returns {Promise<{
 *   path: string[],
 *   router: string,
 *   amountOut: bigint
 * } | null>}
 */
export async function findBestRoute({
  tokenIn,
  tokenOut,
  amountIn,
  intermediates,
  routers,
  aggregator
}) {
  /* --------------------------- gera caminhos --------------------------- */
  const paths = [];

  // 1-hop
  paths.push([tokenIn, tokenOut]);

  // 2-hop
  intermediates.forEach((mid) => {
    if (mid !== tokenIn && mid !== tokenOut) {
      paths.push([tokenIn, mid, tokenOut]);
    }
  });

  // 3-hop
  intermediates.forEach((i1) => {
    intermediates.forEach((i2) => {
      // evita repetições
      if (new Set([tokenIn, i1, i2, tokenOut]).size === 4) {
        paths.push([tokenIn, i1, i2, tokenOut]);
      }
    });
  });

  /* ----------------------- testa rotas + routers ----------------------- */
  const results = [];

  for (const path of paths) {
    for (const router of routers) {
      try {
        // aggregator retorna [bestAmountOut, bestRouter]
        const [amountOut] = await aggregator.getBestAmountsOutOnUniswapForks(
          path,
          amountIn
        );

        // amountOut já é bigint no ethers v6
        if (amountOut > 0n) {
          results.push({ path, router, amountOut });
        }
      } catch (err) {
        console.error(
          `Erro simulando rota ${path.join(" → ")} via ${router}:`,
          err
        );
      }
    }
  }

  /* --------------------------- escolhe a melhor ------------------------ */
  return results.reduce(
    (best, curr) => (!best || curr.amountOut > best.amountOut ? curr : best),
    null
  );
}
