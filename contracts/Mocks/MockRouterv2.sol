// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title MockRouterV2 - Simula a lógica de getAmountsOut para testes com Aggregator.sol
contract MockRouterV2 {
    struct Pair {
        uint112 reserve0;
        uint112 reserve1;
        address token0;
        address token1;
    }

    // tokenA => tokenB => Pair info
    mapping(address => mapping(address => Pair)) public pairs;

    /// @notice Seta reservas de liquidez para um par (simétrico nos dois sentidos)
    function setPair(address tokenA, address tokenB, uint112 reserveA, uint112 reserveB) external {
        pairs[tokenA][tokenB] = Pair(reserveA, reserveB, tokenA, tokenB);
        pairs[tokenB][tokenA] = Pair(reserveB, reserveA, tokenB, tokenA);
    }

    /// @notice Simula o retorno de saída esperado, conforme fórmula UniswapV2
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        amounts = new uint[](path.length);
        amounts[0] = amountIn;

        for (uint i = 0; i < path.length - 1; i++) {
            Pair memory pair = pairs[path[i]][path[i + 1]];
            require(pair.reserve0 > 0 && pair.reserve1 > 0, "Pair not set");

            uint reserveIn = pair.token0 == path[i] ? pair.reserve0 : pair.reserve1;
            uint reserveOut = pair.token0 == path[i] ? pair.reserve1 : pair.reserve0;

            amounts[i + 1] = _getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    /// @notice Executa swap simulada, apenas computa valores como se fosse Uniswap
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(path.length >= 2, "MockRouterV2: invalid path");
        require(block.timestamp <= deadline, "MockRouterV2: expired");

        amounts = new uint[](path.length);
        amounts[0] = amountIn;

        for (uint i = 0; i < path.length - 1; i++) {
            Pair memory pair = pairs[path[i]][path[i + 1]];
            require(pair.reserve0 > 0 && pair.reserve1 > 0, "MockRouterV2: pair not set");

            uint reserveIn = pair.token0 == path[i] ? pair.reserve0 : pair.reserve1;
            uint reserveOut = pair.token0 == path[i] ? pair.reserve1 : pair.reserve0;

            amounts[i + 1] = _getAmountOut(amounts[i], reserveIn, reserveOut);
        }

        require(amounts[amounts.length - 1] >= amountOutMin, "MockRouterV2: insufficient output");

        // Simulação apenas: não movimenta tokens nem armazena saldo
        return amounts;
    }

    /// @notice Fórmula Uniswap sem fee customizável (usa 0.3% padrão)
    function _getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = reserveIn * 1000 + amountInWithFee;
        return numerator / denominator;
    }

    /// @notice Interface simulada para compatibilidade com Aggregator
    function WETH() external pure returns (address) {
        return address(0xdead); // mock address
    }
}
