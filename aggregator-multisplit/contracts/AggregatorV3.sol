// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./lib/RouterLib.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IWETH.sol";

contract AggregatorV2MultiSplit is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private whitelistedRouters;
    address public feeReceiver;
    address public WETH; // support for native token via wrapper
    uint16 public feeBps; // fixed fee in bps (e.g., 25 = 0.25%)

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
        require(_feeBps <= 1000, "Fee too high"); // max fee 10%
        feeBps = _feeBps; // default suggested: 25 (0.25%)
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
        require(newFeeBps <= 1000, "Fee too high");
        feeBps = newFeeBps;
        emit FeeBpsUpdated(newFeeBps);
    }

    function swapMultiSplit(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata intermediates,
        uint256 parts,
        uint256 deadline
    ) external nonReentrant returns (uint256 totalReceived) {
        require(amountIn > 0, "Zero input amount");
        require(parts > 0, "Parts must be greater than zero");
        require(intermediates.length <= 2, "Too many intermediates");

        uint256 amountPerPart = amountIn / parts;
        for (uint256 i = 0; i < parts; i++) {
            uint256 amountToSwap = (i == parts - 1) ? (amountIn - (amountPerPart * (parts - 1))) : amountPerPart;
            totalReceived += _swap(amountToSwap, tokenIn, tokenOut, intermediates, deadline);
        }
    }

    function _swap(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata intermediates,
        uint256 deadline
    ) internal returns (uint256 receivedAmount) {
        require(amountIn > 0, "Zero input amount");
        require(whitelistedRouters.contains(msg.sender), "Router not allowed");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(msg.sender, 0);
        IERC20(tokenIn).safeApprove(msg.sender, amountIn);

        uint256[] memory amounts = IUniswapV2Router02(msg.sender).swapExactTokensForTokens(
            amountIn,
            0, // minOut can be calculated based on slippage
            RouterLib.arr2(tokenIn, tokenOut), // assuming a direct swap for simplicity
            address(this),
            deadline
        );

        receivedAmount = amounts[amounts.length - 1];
        uint256 fee = (receivedAmount * feeBps) / 10_000;
        uint256 finalAmount = receivedAmount - fee;

        IERC20(tokenOut).safeTransfer(msg.sender, finalAmount);
        if (fee > 0) {
            IERC20(tokenOut).safeTransfer(feeReceiver, fee);
        }

        emit SwapExecuted(msg.sender, msg.sender, RouterLib.arr2(tokenIn, tokenOut), amountIn, receivedAmount, 0, fee);
    }
}