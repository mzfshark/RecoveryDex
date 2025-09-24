// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Mock de Router V2 que calcula amountsOut por multiplicadores configuráveis por par
contract MockRouterV2 is IUniswapV2Router02 {
    using SafeERC20 for IERC20;

    // fator de preço por par (tokenIn=>tokenOut)=>multiplier (ex: 120% = 1.2e18)
    mapping(address => mapping(address => uint256)) public priceMul;

    // slippage em bps aplicado na execução do swap (para simular execução pior que quote)
    uint256 public execSlippageBps = 0; // 0 por padrão

    function setPriceMul(address a, address b, uint256 mul) external {
        priceMul[a][b] = mul; // mul em 1e18
    }

    function setExecSlippageBps(uint256 bps) external {
        execSlippageBps = bps;
    }

    function getAmountsOut(uint amountIn, address[] calldata path) external view override returns (uint[] memory amounts) {
        require(path.length >= 2, "path");
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i = 0; i < path.length - 1; i++) {
            uint256 mul = priceMul[path[i]][path[i+1]];
            require(mul > 0, "no price");
            // amounts[i+1] = amounts[i] * mul / 1e18
            amounts[i+1] = (amounts[i] * mul) / 1e18;
        }
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external override returns (uint[] memory amounts) {
        require(deadline >= block.timestamp, "deadline");
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        // calcular amountsOut como getAmountsOut e aplicar slippage de execução
        for (uint i = 0; i < path.length - 1; i++) {
            uint256 mul = priceMul[path[i]][path[i+1]];
            require(mul > 0, "no price");
            amounts[i+1] = (amounts[i] * mul) / 1e18;
        }
        uint out = amounts[amounts.length - 1];
        if (execSlippageBps > 0) {
            out = (out * (10_000 - execSlippageBps)) / 10_000;
            amounts[amounts.length - 1] = out;
        }
        require(out >= amountOutMin, "slippage");

        // transferências simbólicas: puxar tokenIn do caller e enviar tokenOut ao destinatário
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(path[path.length-1]).safeTransfer(to, out);
    }

    // unused functions to satisfy interface
    function factory() external pure returns (address) { return address(0); }
    function WETH() external pure returns (address) { return address(0); }
    function addLiquidity(address,address,uint,uint,uint,uint,address,uint) external pure returns (uint,uint,uint) { return (0,0,0); }
    function addLiquidityETH(address,uint,uint,uint,address,uint) external payable returns (uint,uint,uint) { return (0,0,0); }
    function removeLiquidity(address,address,uint,uint,uint,address,uint) external pure returns (uint,uint) { return (0,0); }
    function removeLiquidityETH(address,uint,uint,uint,address,uint) external pure returns (uint,uint) { return (0,0); }
    function removeLiquidityWithPermit(address,address,uint,uint,uint,address,uint,bool,uint8,bytes32,bytes32) external pure returns (uint,uint) { return (0,0); }
    function removeLiquidityETHWithPermit(address,uint,uint,uint,address,uint,bool,uint8,bytes32,bytes32) external pure returns (uint,uint) { return (0,0); }
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable override returns (uint[] memory) {
        return new uint[](0);
    }
    function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external override returns (uint[] memory) {
        return new uint[](0);
    }
    function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external override returns (uint[] memory) {
        return new uint[](0);
    }
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external override returns (uint[] memory) {
        return new uint[](0);
    }
    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable override returns (uint[] memory) {
        return new uint[](0);
    }
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint,address[] calldata,address,uint) external payable {}
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint,address[] calldata,address,uint) external pure {}
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint,address[] calldata,address,uint) external pure {}
}
