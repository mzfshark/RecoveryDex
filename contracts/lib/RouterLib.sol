// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title RouterLib
/// @notice Biblioteca para construção de caminhos e cálculo de slippage para Aggregator
library RouterLib {
    /// @notice Retorna um array [a, b]
    function arr2(address a, address b) internal pure returns (address[] memory r) {
        r = new address[](2);
        r[0] = a;
        r[1] = b;
    }

    /// @notice Retorna um array [a, b, c]
    function arr3(address a, address b, address c) internal pure returns (address[] memory r) {
        r = new address[](3);
        r[0] = a;
        r[1] = b;
        r[2] = c;
    }

    /// @notice Retorna um array [a, b, c, d]
    function arr4(address a, address b, address c, address d) internal pure returns (address[] memory r) {
        r = new address[](4);
        r[0] = a;
        r[1] = b;
        r[2] = c;
        r[3] = d;
    }

    /// @notice Calcula slippage em basis points (bps)
    function slippageBps(uint256 quotedOut, uint256 actualOut) internal pure returns (uint256) {
        if (actualOut >= quotedOut) return 0;
        uint256 diff = quotedOut - actualOut;
        return (diff * 10_000) / quotedOut;
    }

    /// @notice Calcula a fee proporcional com limite de 0.2% (20 bps)
    function feeFromSlippage(uint256 actualOut, uint256 slippageBps) internal pure returns (uint256) {
        uint256 fee = (actualOut * slippageBps) / 1_000_000;
        uint256 maxFee = (actualOut * 2) / 1000; // 0.2%
        return fee > maxFee ? maxFee : fee;
    }
} 
