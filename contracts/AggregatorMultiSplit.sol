// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IWETH.sol";
import "./lib/RouterLib.sol";

/// @title AggregatorMultiSplit (Harmony-only)
/// @notice Encontra melhor rota em múltiplos routers com tokens intermediários e divide ordens grandes em partes menores.
contract AggregatorMultiSplit is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // Limites
    uint8 public constant MAX_HOPS = 4; // in -> X -> Y -> out
    uint8 public constant MAX_INTERMEDIATE = 2;
    uint8 public constant MAX_PARTS = 10; // limite de splits para gas safety
    uint16 public constant MAX_FEE_BPS = 1000; // 10%

    // Whitelists / config
    EnumerableSet.AddressSet private whitelistedRouters;
    EnumerableSet.AddressSet private allowedIntermediates; // JEWEL/SONIC/VIPER/... configuráveis
    address public WETH; // WONE em Harmony
    address public feeReceiver;
    uint16 public feeBps; // ex.: 25 = 0.25%

    // Events
    event RouterAdded(address indexed router);
    event RouterRemoved(address indexed router);
    event IntermediateAdded(address indexed token);
    event IntermediateRemoved(address indexed token);
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

    constructor(address _owner, address _weth, address[] memory _routers, address[] memory _intermediates, uint16 _feeBps) {
        require(_owner != address(0), "owner=0");
        require(_weth != address(0), "weth=0");
        require(_routers.length > 0, "No routers");
        for (uint256 i = 0; i < _routers.length; i++) {
            require(_routers[i] != address(0), "router=0");
            whitelistedRouters.add(_routers[i]);
            emit RouterAdded(_routers[i]);
        }
        for (uint256 j = 0; j < _intermediates.length; j++) {
            if (_intermediates[j] != address(0)) {
                allowedIntermediates.add(_intermediates[j]);
                emit IntermediateAdded(_intermediates[j]);
            }
        }
        WETH = _weth;
        feeReceiver = _owner;
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        feeBps = _feeBps == 0 ? 25 : _feeBps; // default 0.25%
        _transferOwnership(_owner);
    }

    // ---------- Admin ----------
    function addRouter(address router) external onlyOwner {
        require(router != address(0), "Zero address");
        require(whitelistedRouters.add(router), "Already whitelisted");
        emit RouterAdded(router);
    }

    function removeRouter(address router) external onlyOwner {
        require(whitelistedRouters.remove(router), "Not found");
        emit RouterRemoved(router);
    }

    function addIntermediate(address token) external onlyOwner {
        require(token != address(0), "Zero address");
        require(allowedIntermediates.add(token), "Already added");
        emit IntermediateAdded(token);
    }

    function removeIntermediate(address token) external onlyOwner {
        require(allowedIntermediates.remove(token), "Not found");
        emit IntermediateRemoved(token);
    }

    function setFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "Zero address");
        feeReceiver = newReceiver;
        emit FeeReceiverUpdated(newReceiver);
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

    // ---------- Views ----------
    function getRouters() external view returns (address[] memory list) {
        uint256 n = whitelistedRouters.length();
        list = new address[](n);
        for (uint256 i = 0; i < n; i++) list[i] = whitelistedRouters.at(i);
    }

    function getIntermediates() external view returns (address[] memory list) {
        uint256 n = allowedIntermediates.length();
        list = new address[](n);
        for (uint256 i = 0; i < n; i++) list[i] = allowedIntermediates.at(i);
    }

    function quote(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata extraIntermediates
    ) external view returns (uint256 bestOut, address bestRouter, address[] memory bestPath) {
        require(amountIn > 0, "amountIn=0");
        require(tokenIn != tokenOut, "identical");
        (bestOut, bestRouter, bestPath) = _quoteInternal(amountIn, tokenIn, tokenOut, extraIntermediates);
    }

    // ---------- Core ----------
    function swapMultiSplit(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata extraIntermediates,
        uint256 parts,
        uint256 deadline
    ) external nonReentrant returns (uint256 netOut) {
        require(amountIn > 0, "amountIn=0");
        require(parts > 0 && parts <= MAX_PARTS, "invalid parts");
        require(tokenIn != tokenOut, "identical");

        // Pull total once
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 totalOut = _executeSplits(amountIn, tokenIn, tokenOut, extraIntermediates, parts, deadline);

        uint256 fee = (totalOut * feeBps) / 10_000;
        netOut = totalOut - fee;
        if (fee > 0) IERC20(tokenOut).safeTransfer(feeReceiver, fee);
        IERC20(tokenOut).safeTransfer(msg.sender, netOut);
    }

    /// @notice Executa o swap dividido usando saldo já no contrato (sem transferFrom)
    function _executeSplits(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata extraIntermediates,
        uint256 parts,
        uint256 deadline
    ) internal returns (uint256 totalOut) {
        uint256 amountPerPart = amountIn / parts;
        for (uint256 i = 0; i < parts; i++) {
            uint256 amt = (i == parts - 1) ? (amountIn - amountPerPart * (parts - 1)) : amountPerPart;
            (uint256 quotedOut, address router, address[] memory path) = _quoteInternal(amt, tokenIn, tokenOut, extraIntermediates);
            require(quotedOut > 0 && router != address(0), "no route");

            // Approve router para esta parte
            IERC20(tokenIn).safeApprove(router, 0);
            IERC20(tokenIn).safeApprove(router, amt);

            // Min out com margem de segurança: 2% default
            uint256 minOut = (quotedOut * 98) / 100;
            uint256[] memory amounts = IUniswapV2Router02(router).swapExactTokensForTokens(
                amt,
                minOut,
                path,
                address(this),
                deadline
            );

            uint256 out = amounts[amounts.length - 1];
            totalOut += out;

            emit SwapExecuted(msg.sender, router, path, amt, out, 200, 0);
        }
    }

    /// @notice Entrada nativa (ONE). Wrap para WETH, executa split e opcionalmente envia saída nativa se tokenOut==address(0)
    function swapMultiSplitNative(
        address tokenOut, // address(0) => saída nativa (ONE)
        address[] calldata extraIntermediates,
        uint256 parts,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 netOut) {
        uint256 amountIn = msg.value;
        require(amountIn > 0, "amountIn=0");
        require(parts > 0 && parts <= MAX_PARTS, "invalid parts");

        // Wrap ONE -> WETH
        IWETH(WETH).deposit{value: amountIn}();

        address actualTokenOut = tokenOut == address(0) ? WETH : tokenOut;

        uint256 totalOut = _executeSplits(amountIn, WETH, actualTokenOut, extraIntermediates, parts, deadline);

        uint256 fee = (totalOut * feeBps) / 10_000;
        uint256 remaining = totalOut - fee;

        if (fee > 0) IERC20(actualTokenOut).safeTransfer(feeReceiver, fee);

        if (tokenOut == address(0)) {
            // Unwrap WETH -> ONE e envia nativo
            IWETH(WETH).withdraw(remaining);
            (bool ok, ) = msg.sender.call{value: remaining}("");
            require(ok, "native transfer failed");
            netOut = remaining;
        } else {
            IERC20(actualTokenOut).safeTransfer(msg.sender, remaining);
            netOut = remaining;
        }
    }

    /// @notice Saída nativa (ONE). Executa split para WETH e deswrapa para enviar nativo numa única transação.
    function swapMultiSplitToNative(
        uint256 amountIn,
        address tokenIn,
        address[] calldata extraIntermediates,
        uint256 parts,
        uint256 deadline
    ) external nonReentrant returns (uint256 netOut) {
        require(amountIn > 0, "amountIn=0");
        require(parts > 0 && parts <= MAX_PARTS, "invalid parts");

        // Pull total
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 totalOut = _executeSplits(amountIn, tokenIn, WETH, extraIntermediates, parts, deadline);

        uint256 fee = (totalOut * feeBps) / 10_000;
        uint256 remaining = totalOut - fee;

        if (fee > 0) IERC20(WETH).safeTransfer(feeReceiver, fee);

        // Unwrap WETH -> ONE e envia nativo
        IWETH(WETH).withdraw(remaining);
        (bool ok, ) = msg.sender.call{value: remaining}("");
        require(ok, "native transfer failed");
        netOut = remaining;
    }

    // Busca melhor rota entre routers e paths com até 2 intermediários
    function _quoteInternal(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        address[] calldata extraIntermediates
    ) internal view returns (uint256 bestOut, address bestRouter, address[] memory bestPath) {
        uint256 routersN = whitelistedRouters.length();
        require(routersN > 0, "no routers");

        // Candidatos de intermediários: whitelist + extras do caller (UNKNOWN permitido para busca)
        // Nota: não transferimos/approvamos estes tokens, então é seguro considerar qualquer endereço como hop em path.
        uint256 allowN = allowedIntermediates.length();
        uint256 extraN = extraIntermediates.length;

        for (uint256 r = 0; r < routersN; r++) {
            address router = whitelistedRouters.at(r);

            // 1) Direto
            {
                address[] memory p = RouterLib.arr2(tokenIn, tokenOut);
                uint256 out = _safeQuote(router, amountIn, p);
                if (out > bestOut) { bestOut = out; bestRouter = router; bestPath = p; }
            }

            // 2) Um intermediário (whitelist)
            for (uint256 i = 0; i < allowN; i++) {
                address x = allowedIntermediates.at(i);
                if (x == tokenIn || x == tokenOut) continue;
                address[] memory p = RouterLib.arr3(tokenIn, x, tokenOut);
                uint256 out = _safeQuote(router, amountIn, p);
                if (out > bestOut) { bestOut = out; bestRouter = router; bestPath = p; }
            }
            // 2b) Um intermediário (extras)
            for (uint256 j = 0; j < extraN; j++) {
                address x2 = extraIntermediates[j];
                if (x2 == address(0) || x2 == tokenIn || x2 == tokenOut) continue;
                address[] memory p2 = RouterLib.arr3(tokenIn, x2, tokenOut);
                uint256 out2 = _safeQuote(router, amountIn, p2);
                if (out2 > bestOut) { bestOut = out2; bestRouter = router; bestPath = p2; }
            }

            // 3) Dois intermediários (whitelist x whitelist)
            for (uint256 i2 = 0; i2 < allowN; i2++) {
                address a = allowedIntermediates.at(i2);
                if (a == tokenIn || a == tokenOut) continue;
                for (uint256 j2 = 0; j2 < allowN; j2++) {
                    address b = allowedIntermediates.at(j2);
                    if (b == tokenIn || b == tokenOut || b == a) continue;
                    address[] memory p3 = RouterLib.arr4(tokenIn, a, b, tokenOut);
                    uint256 out3 = _safeQuote(router, amountIn, p3);
                    if (out3 > bestOut) { bestOut = out3; bestRouter = router; bestPath = p3; }
                }
            }
        }
    }

    function _safeQuote(address router, uint256 amountIn, address[] memory path) internal view returns (uint256 out) {
        if (amountIn == 0) return 0;
        // Evitar chamadas desnecessárias quando hops inválidos
        for (uint256 i = 0; i + 1 < path.length; i++) {
            if (path[i] == address(0) || path[i+1] == address(0)) return 0;
        }
        try IUniswapV2Router02(router).getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            if (amounts.length > 0) {
                out = amounts[amounts.length - 1];
            }
        } catch {
            out = 0;
        }
    }

    // ---------- ETH (WONE) helpers (opcionais) ----------
    receive() external payable {}
}