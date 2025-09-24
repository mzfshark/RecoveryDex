import { ethers } from "ethers";

export async function swap(
  aggregator,
  path,
  router,
  amountIn,
  minAmountOut,
  slippagePercent,
  deadline
) {
  if (!aggregator || !router || !path?.length || !amountIn || !minAmountOut) {
    throw new Error('Parâmetros inválidos para swap');
  }

  try {
    const tokenIn = path[0];
    const signer = aggregator.signer;

    const tokenContract = new ethers.Contract(tokenIn, [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)'
    ], signer);

    const owner = await signer.getAddress();
    const allowance = await tokenContract.allowance(owner, aggregator.target);

    if (allowance < amountIn) {
      const txApprove = await tokenContract.approve(aggregator.target, amountIn);
      await txApprove.wait();
    }

    const tx = await aggregator.swapOnUniswapFork(
      path,
      router,
      amountIn,
      minAmountOut,
      slippagePercent,
      deadline
    );

    return tx;
  } catch (err) {
    console.error('Erro ao executar swap:', err);
    throw new Error(err.message);
  }
}
