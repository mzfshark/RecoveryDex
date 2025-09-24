// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./lib/RouterLib.sol";

interface IUniswapV2Router02 {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}

contract AggregatorV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using RouterLib for *;

    uint8 public constant MAX_HOPS = 3;
    // Alinhado à busca implementada (no máximo 2 intermediários = 3 hops)
    uint16 public constant MAX_INTERMEDIATE = 2;
    uint16 public constant MAX_SLIPPAGE_BPS = 2000; // 20%
    uint16 public constant MAX_FEE_BPS = 1000; // 10% como teto de segurança

    EnumerableSet.AddressSet private whitelistedRouters;
    address public feeReceiver;
    address public WETH; // suporte a token nativo via wrapper
    uint16 public feeBps; // taxa fixa em bps (ex.: 25 = 0.25%)

    event RouterAdded(address indexed router);
    event RouterRemoved(address indexed router);
    event FeeReceiverUpdated(address indexed newReceiver);
    event WETHUpdated(address indexed newWETH);
    event FeeBpsUpdated(uint16 newFeeBps);
    event SwapExecuted(
        address indexed user,
        address indexed router,
        address[] path,
        uint256 amountIn,
        uint256 amountOut,
        uint256 slippageBps,
        uint256 feeAmount
    );

    constructor(address _owner, address[] memory _routers, uint16 _feeBps) {
        require(_routers.length > 0, "No routers provided");
        for (uint256 i = 0; i < _routers.length; i++) {
            require(_routers[i] != address(0), "Zero address");
            whitelistedRouters.add(_routers[i]);
        }
        feeReceiver = _owner;
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        feeBps = _feeBps; // default sugerido: 25 (0.25%)
        _transferOwnership(_owner);
    }

    function setFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "Zero address");
        feeReceiver = newReceiver;
        emit FeeReceiverUpdated(newReceiver);
    }

    function addRouter(address router) external onlyOwner {
        require(router != address(0), "Zero address");
        require(whitelistedRouters.add(router), "Already whitelisted");
        emit RouterAdded(router);
    }

    function removeRouter(address router) external onlyOwner {
        require(whitelistedRouters.remove(router), "Not found");
        emit RouterRemoved(router);
    }

    function setWETH(address _weth) external onlyOwner {
        require(_weth != address(0), "Zero address");
        WETH = _weth;
        emit WETHUpdated(_weth);
    }

    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "Fee too high");
        feeBps = newFeeBps;
        emit FeeBpsUpdated(newFeeBps);
    }

    function getRouterCount() external view returns (uint256) {
        return whitelistedRouters.length();
    }

    function getRouterAt(uint256 index) external view returns (address) {
        return whitelistedRouters.at(index);
    }

    function getRouters() external view returns (address[] memory list) {
        uint256 n = whitelistedRouters.length();
        list = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            list[i] = whitelistedRouters.at(i);
        }
    }

    function quote(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata intermediates
    ) external view returns (uint256 bestOut, address bestRouter, address[] memory bestPath) {
        require(amountIn > 0, "Zero input amount");
        require(tokenIn != tokenOut, "Identical tokens");
        (bestOut, bestRouter, bestPath) = _quoteInternal(amountIn, tokenIn, tokenOut, intermediates);
    }

    function swap(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata intermediates,
        uint256 deadline
    ) external nonReentrant returns (uint256) {
        require(amountIn > 0, "Zero input amount");
        require(intermediates.length <= MAX_INTERMEDIATE, "Too many hops");
        (uint256 quotedOut, address router, address[] memory path) = _quoteInternal(amountIn, tokenIn, tokenOut, intermediates);
        require(quotedOut > 0, "No route found");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(router, 0);
        IERC20(tokenIn).safeApprove(router, amountIn);

        uint256 minOut = (quotedOut * (10_000 - MAX_SLIPPAGE_BPS)) / 10_000;
        uint256[] memory amounts = IUniswapV2Router02(router).swapExactTokensForTokens(
            amountIn,
            minOut,
            path,
            address(this),
            deadline
        );

        uint256 finalOut = amounts[amounts.length - 1];
        {
            uint256 slippageBps = RouterLib.slippageBps(quotedOut, finalOut);
            require(slippageBps <= MAX_SLIPPAGE_BPS, "Excessive slippage");
            uint256 fee = (finalOut * feeBps) / 10_000;
            uint256 receivedAmount = finalOut - fee;
            // Como alguns mocks não movimentam tokens, garantir saldo suficiente transferindo do próprio contrato
            IERC20(tokenOut).safeTransfer(msg.sender, receivedAmount);
            if (fee > 0) {
                IERC20(tokenOut).safeTransfer(feeReceiver, fee);
            }
            // Limpeza opcional de aprovações
            IERC20(tokenIn).safeApprove(router, 0);
            emit SwapExecuted(msg.sender, router, path, amountIn, finalOut, slippageBps, fee);
            return receivedAmount;
        }
    }

    /// @notice Swap com slippage parametrizável pelo usuário (limitado pelo MAX_SLIPPAGE_BPS)
    function swapWithSlippage(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata intermediates,
        uint256 userMaxSlippageBps,
        uint256 deadline
    ) external nonReentrant returns (uint256) {
        require(amountIn > 0, "Zero input amount");
        require(intermediates.length <= MAX_INTERMEDIATE, "Too many hops");
        require(userMaxSlippageBps <= MAX_SLIPPAGE_BPS, "Slippage too high");

        (uint256 quotedOut, address router, address[] memory path) = _quoteInternal(amountIn, tokenIn, tokenOut, intermediates);
        require(quotedOut > 0, "No route found");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(router, 0);
        IERC20(tokenIn).safeApprove(router, amountIn);

        uint256 minOut = (quotedOut * (10_000 - userMaxSlippageBps)) / 10_000;
        uint256[] memory amounts = IUniswapV2Router02(router).swapExactTokensForTokens(
            amountIn,
            minOut,
            path,
            address(this),
            deadline
        );
        uint256 finalOut = amounts[amounts.length - 1];
        {
            uint256 slippageBps = RouterLib.slippageBps(quotedOut, finalOut);
            require(slippageBps <= userMaxSlippageBps, "Excessive slippage");
            uint256 fee = (finalOut * feeBps) / 10_000;
            uint256 receivedAmount = finalOut - fee;
            IERC20(tokenOut).safeTransfer(msg.sender, receivedAmount);
            if (fee > 0) {
                IERC20(tokenOut).safeTransfer(feeReceiver, fee);
            }
            IERC20(tokenIn).safeApprove(router, 0);
            emit SwapExecuted(msg.sender, router, path, amountIn, finalOut, slippageBps, fee);
            return receivedAmount;
        }
    }

    /// @notice Swap com path e router pré-calculados off-chain (mais barato em gas)
    function swapWithPath(
        address router,
        address[] calldata path,
        uint256 amountIn,
        uint256 minOut,
        uint256 deadline
    ) external nonReentrant returns (uint256) {
        require(router != address(0), "Zero router");
        require(whitelistedRouters.contains(router), "Router not allowed");
        require(path.length >= 2, "Invalid path");
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];
        require(tokenIn != tokenOut, "Identical tokens");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(router, 0);
        IERC20(tokenIn).safeApprove(router, amountIn);

        uint256[] memory amounts = IUniswapV2Router02(router).swapExactTokensForTokens(
            amountIn,
            minOut,
            path,
            address(this),
            deadline
        );
        uint256 finalOut = amounts[amounts.length - 1];
        {
            // Sem validação de slippage on-chain aqui; minOut já protege o usuário
            uint256 slippageBps = 0;
            uint256 fee = (finalOut * feeBps) / 10_000;
            uint256 receivedAmount = finalOut - fee;
            IERC20(tokenOut).safeTransfer(msg.sender, receivedAmount);
            if (fee > 0) {
                IERC20(tokenOut).safeTransfer(feeReceiver, fee);
            }
            IERC20(tokenIn).safeApprove(router, 0);
            emit SwapExecuted(msg.sender, router, path, amountIn, finalOut, slippageBps, fee);
            return receivedAmount;
        }
    }

    function _findBestPath(
        address router,
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata intermediates
    ) internal view returns (uint256 bestOut, address[] memory bestPath) {
        bestPath = RouterLib.arr2(tokenIn, tokenOut);
        bestOut = _safeQuote(router, amountIn, bestPath);

        if (intermediates.length == 0) return (bestOut, bestPath);

        for (uint256 i = 0; i < intermediates.length; i++) {
            address mid = intermediates[i];
            if (mid == tokenIn || mid == tokenOut) continue;
            address[] memory path2 = RouterLib.arr3(tokenIn, mid, tokenOut);
            uint256 out2 = _safeQuote(router, amountIn, path2);
            if (out2 > bestOut) {
                bestOut = out2;
                bestPath = path2;
            }

            for (uint256 j = 0; j < intermediates.length; j++) {
                if (j == i) continue;
                address mid2 = intermediates[j];
                if (mid2 == tokenIn || mid2 == tokenOut || mid2 == mid) continue;
                address[] memory path3 = RouterLib.arr4(tokenIn, mid, mid2, tokenOut);
                uint256 out3 = _safeQuote(router, amountIn, path3);
                if (out3 > bestOut) {
                    bestOut = out3;
                    bestPath = path3;
                }
            }
        }
    }

    function _safeQuote(address router, uint256 amountIn, address[] memory path) internal view returns (uint256 out) {
        if (path.length < 2) return 0;
        try IUniswapV2Router02(router).getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            out = amounts[amounts.length - 1];
        } catch {
            out = 0;
        }
    }

    function _quoteInternal(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata intermediates
    ) internal view returns (uint256 bestOut, address bestRouter, address[] memory bestPath) {
        uint256 routerCount = whitelistedRouters.length();
        for (uint256 i = 0; i < routerCount; i++) {
            address router = whitelistedRouters.at(i);
            (uint256 out, address[] memory path) = _findBestPath(router, amountIn, tokenIn, tokenOut, intermediates);
            if (out > bestOut) {
                bestOut = out;
                bestRouter = router;
                bestPath = path;
            }
        }
    }

    // ---------- Suporte ETH via WETH ----------
    receive() external payable {}

    function swapETHForTokenWithSlippage(
        address router,
        address[] calldata path, // path deve começar com WETH e terminar no token desejado
        uint256 minOut,
        uint256 deadline
    ) external payable nonReentrant returns (uint256) {
        require(WETH != address(0), "WETH not set");
        require(whitelistedRouters.contains(router), "Router not allowed");
        require(path.length >= 2 && path[0] == WETH, "Invalid path");
        require(msg.value > 0, "Zero ETH");

        IWETH(WETH).deposit{value: msg.value}();
        IERC20(WETH).safeApprove(router, 0);
        IERC20(WETH).safeApprove(router, msg.value);

        uint256[] memory amounts = IUniswapV2Router02(router).swapExactTokensForTokens(
            msg.value,
            minOut,
            path,
            address(this),
            deadline
        );
        uint256 finalOut = amounts[amounts.length - 1];
        {
            uint256 fee = (finalOut * feeBps) / 10_000;
            uint256 receivedAmount = finalOut - fee;
            IERC20(path[path.length - 1]).safeTransfer(msg.sender, receivedAmount);
            if (fee > 0) {
                IERC20(path[path.length - 1]).safeTransfer(feeReceiver, fee);
            }
            IERC20(WETH).safeApprove(router, 0);
            return receivedAmount;
        }
    }

    function swapTokenForETHWithSlippage(
        address router,
        address[] calldata path, // path deve terminar em WETH
        uint256 amountIn,
        uint256 minOut,
        uint256 deadline
    ) external nonReentrant returns (uint256) {
        require(WETH != address(0), "WETH not set");
        require(whitelistedRouters.contains(router), "Router not allowed");
        require(path.length >= 2 && path[path.length - 1] == WETH, "Invalid path");

        address tokenIn = path[0];
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(router, 0);
        IERC20(tokenIn).safeApprove(router, amountIn);

        uint256[] memory amounts = IUniswapV2Router02(router).swapExactTokensForTokens(
            amountIn,
            minOut,
            path,
            address(this),
            deadline
        );
        uint256 finalWETH = amounts[amounts.length - 1];
        IWETH(WETH).withdraw(finalWETH);

        // Sem slippage tracking; minOut protege o usuário
        uint256 receivedETH = address(this).balance;
        (bool ok, ) = msg.sender.call{value: receivedETH}("");
        require(ok, "ETH transfer failed");
        IERC20(tokenIn).safeApprove(router, 0);
        return receivedETH;
    }
}
