// src/services/lpRecoveryService.js
import { ethers } from "ethers";
import { getProvider } from "./provider.js";
import { notify } from "./notificationService.js";
import factoryList from "../factory.json";
import ERC20ABI from "../abis/ERC20ABI.json";

// ABIs mínimos necessários
const UNISWAP_V2_PAIR_ABI = [
  // Funções de consulta
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  
  // Funções de remoção de liquidez
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  
  // Eventos
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

const UNISWAP_V2_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function allPairs(uint256) view returns (address pair)",
  "function allPairsLength() view returns (uint256)"
];

const UNISWAP_V2_ROUTER_ABI = [
  "function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB)",
  "function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) returns (uint256 amountToken, uint256 amountETH)",
  "function WETH() view returns (address)"
];

// Endereços conhecidos de roteadores para cada factory
const FACTORY_TO_ROUTER = {
  "0x7D02c116b98d0965ba7B642ace0183ad8b8D2196": "0xf012702a5f0e54015362cBCA26a26fc90AA832a3", // ViperSwap
  "0xc35DADB65012eC5796536bD9864eD8773aBc74C4": "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // SushiSwap
  "0x9014B937069918bd319f80e8B3BB4A2cf6FAA5F7": "0x24ad62502d1C652Cc7684081169D04896aC20f30", // DFK
  // Adicione mais conforme necessário
};

const WONE_ADDRESS = "0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a";

/**
 * Classe para gerenciar a recuperação de LPs
 */
class LPRecoveryService {
  constructor() {
    this.provider = null;
    this.signer = null;
  }

  /**
   * Inicializa o serviço com provider e signer
   */
  async initialize(signer = null) {
    this.provider = getProvider();
    this.signer = signer;
    
    if (!this.provider) {
      throw new Error("Provider não disponível");
    }
  }

  /**
   * Busca todos os LPs que o usuário possui
   */
  async getUserLPs(userAddress) {
    if (!ethers.isAddress(userAddress)) {
      throw new Error("Endereço inválido");
    }

    notify.info("Buscando", "Procurando LPs do usuário...", 5000);
    
    const userLPs = [];
    const factories = Object.values(factoryList.UNISWAP.FACTORY);

    try {
      // Para cada factory, buscar todos os pares e verificar se o usuário tem LP tokens
      for (const factoryAddress of factories) {
        console.log(`[LPRecovery] Verificando factory: ${factoryAddress}`);
        
        try {
          const factoryContract = new ethers.Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, this.provider);
          
          // Buscar número total de pares
          const totalPairs = await factoryContract.allPairsLength();
          console.log(`[LPRecovery] Total de pares na factory ${factoryAddress}: ${totalPairs}`);
          
          // Verificar os primeiros 100 pares (otimização para evitar timeout)
          const maxPairs = Math.min(Number(totalPairs), 100);
          
          for (let i = 0; i < maxPairs; i++) {
            try {
              const pairAddress = await factoryContract.allPairs(i);
              const lpData = await this.checkUserLPBalance(pairAddress, userAddress);
              
              if (lpData.balance > 0n) {
                userLPs.push({
                  ...lpData,
                  factoryAddress,
                  factoryName: this.getFactoryName(factoryAddress)
                });
              }
            } catch (error) {
              console.warn(`[LPRecovery] Erro ao verificar par ${i}:`, error.message);
            }
            
            // Pequeno delay para evitar rate limiting
            if (i % 10 === 0 && i > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } catch (error) {
          console.warn(`[LPRecovery] Erro na factory ${factoryAddress}:`, error.message);
        }
      }

      notify.success("Encontrado", `${userLPs.length} LP(s) encontrado(s)`, 3000);
      return userLPs;
    } catch (error) {
      console.error("[LPRecovery] Erro ao buscar LPs:", error);
      notify.error("Erro", "Erro ao buscar LPs: " + error.message);
      throw error;
    }
  }

  /**
   * Verifica o saldo de LP tokens do usuário em um par específico
   */
  async checkUserLPBalance(pairAddress, userAddress) {
    const pairContract = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);
    
    try {
      const [balance, totalSupply, reserves, token0, token1, symbol] = await Promise.all([
        pairContract.balanceOf(userAddress),
        pairContract.totalSupply(),
        pairContract.getReserves(),
        pairContract.token0(),
        pairContract.token1(),
        pairContract.symbol()
      ]);

      if (balance === 0n) {
        return { balance: 0n, pairAddress };
      }

      // Buscar informações dos tokens
      const token0Contract = new ethers.Contract(token0, ERC20ABI, this.provider);
      const token1Contract = new ethers.Contract(token1, ERC20ABI, this.provider);
      
      const [token0Symbol, token1Symbol, token0Decimals, token1Decimals] = await Promise.all([
        token0Contract.symbol(),
        token1Contract.symbol(),
        token0Contract.decimals(),
        token1Contract.decimals()
      ]);

      // Calcular quantidade de tokens que o usuário receberá
      const userShare = (balance * 10000n) / totalSupply; // porcentagem * 100 para maior precisão
      const token0Amount = (reserves.reserve0 * userShare) / 10000n;
      const token1Amount = (reserves.reserve1 * userShare) / 10000n;

      return {
        pairAddress,
        balance,
        totalSupply,
        symbol,
        token0: {
          address: token0,
          symbol: token0Symbol,
          decimals: token0Decimals,
          amount: token0Amount,
          formattedAmount: ethers.formatUnits(token0Amount, token0Decimals)
        },
        token1: {
          address: token1,
          symbol: token1Symbol,
          decimals: token1Decimals,
          amount: token1Amount,
          formattedAmount: ethers.formatUnits(token1Amount, token1Decimals)
        },
        userShare: Number(userShare) / 100, // porcentagem
        formattedBalance: ethers.formatUnits(balance, 18)
      };
    } catch (error) {
      console.warn(`[LPRecovery] Erro ao verificar par ${pairAddress}:`, error.message);
      return { balance: 0n, pairAddress };
    }
  }

  /**
   * Remove liquidez de um par específico
   */
  async removeLiquidity(lpData, slippage = 5) {
    if (!this.signer) {
      throw new Error("Signer necessário para remover liquidez");
    }

    const routerAddress = FACTORY_TO_ROUTER[lpData.factoryAddress];
    if (!routerAddress) {
      throw new Error(`Router não encontrado para factory ${lpData.factoryAddress}`);
    }

    try {
      notify.info("Processando", "Removendo liquidez...", 10000);

      const routerContract = new ethers.Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, this.signer);
      const pairContract = new ethers.Contract(lpData.pairAddress, UNISWAP_V2_PAIR_ABI, this.signer);
      
      const userAddress = await this.signer.getAddress();
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutos

      // Verificar e aprovar LP tokens para o router
      const allowance = await pairContract.allowance(userAddress, routerAddress);
      if (allowance < lpData.balance) {
        notify.info("Aprovando", "Aprovando LP tokens...", 5000);
        const approveTx = await pairContract.approve(routerAddress, lpData.balance);
        await approveTx.wait();
      }

      // Calcular mínimos com slippage
      const slippageMultiplier = (100 - slippage) * 100n; // Para 5% = 9500
      const amountAMin = (lpData.token0.amount * slippageMultiplier) / 10000n;
      const amountBMin = (lpData.token1.amount * slippageMultiplier) / 10000n;

      let tx;
      // Verificar se um dos tokens é WONE (ONE nativo)
      if (lpData.token0.address.toLowerCase() === WONE_ADDRESS.toLowerCase()) {
        // Token1 + ONE
        tx = await routerContract.removeLiquidityETH(
          lpData.token1.address,
          lpData.balance,
          amountBMin,
          amountAMin,
          userAddress,
          deadline
        );
      } else if (lpData.token1.address.toLowerCase() === WONE_ADDRESS.toLowerCase()) {
        // Token0 + ONE
        tx = await routerContract.removeLiquidityETH(
          lpData.token0.address,
          lpData.balance,
          amountAMin,
          amountBMin,
          userAddress,
          deadline
        );
      } else {
        // Token A + Token B
        tx = await routerContract.removeLiquidity(
          lpData.token0.address,
          lpData.token1.address,
          lpData.balance,
          amountAMin,
          amountBMin,
          userAddress,
          deadline
        );
      }

      notify.info("Confirmando", "Aguardando confirmação da transação...", 15000);
      const receipt = await tx.wait();
      
      notify.success("Sucesso", `Liquidez removida! Hash: ${receipt.hash.slice(0, 10)}...`, 5000);
      return receipt;
    } catch (error) {
      console.error("[LPRecovery] Erro ao remover liquidez:", error);
      notify.error("Erro", "Erro ao remover liquidez: " + error.message);
      throw error;
    }
  }

  /**
   * Remove liquidez de múltiplos pares
   */
  async removeLiquidityBatch(lpDataList, slippage = 5) {
    const results = [];
    
    for (let i = 0; i < lpDataList.length; i++) {
      try {
        notify.info("Progresso", `Removendo LP ${i + 1} de ${lpDataList.length}`, 3000);
        const result = await this.removeLiquidity(lpDataList[i], slippage);
        results.push({ success: true, result, lpData: lpDataList[i] });
        
        // Pequeno delay entre transações
        if (i < lpDataList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`[LPRecovery] Erro no LP ${i}:`, error);
        results.push({ success: false, error: error.message, lpData: lpDataList[i] });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    notify.success("Concluído", `${successful}/${lpDataList.length} LPs removidos com sucesso`, 5000);
    
    return results;
  }

  /**
   * Obtém o nome da factory baseado no endereço
   */
  getFactoryName(factoryAddress) {
    const factories = factoryList.UNISWAP.FACTORY;
    for (const [name, address] of Object.entries(factories)) {
      if (address.toLowerCase() === factoryAddress.toLowerCase()) {
        return name;
      }
    }
    return "Unknown";
  }

  /**
   * Estima o gas para remoção de liquidez
   */
  async estimateGasForRemoval(lpData) {
    if (!this.signer) {
      return null;
    }

    const routerAddress = FACTORY_TO_ROUTER[lpData.factoryAddress];
    if (!routerAddress) {
      return null;
    }

    try {
      const routerContract = new ethers.Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, this.signer);
      const userAddress = await this.signer.getAddress();
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      const amountAMin = lpData.token0.amount * 95n / 100n; // 5% slippage
      const amountBMin = lpData.token1.amount * 95n / 100n;

      let gasEstimate;
      if (lpData.token0.address.toLowerCase() === WONE_ADDRESS.toLowerCase()) {
        gasEstimate = await routerContract.removeLiquidityETH.estimateGas(
          lpData.token1.address,
          lpData.balance,
          amountBMin,
          amountAMin,
          userAddress,
          deadline
        );
      } else if (lpData.token1.address.toLowerCase() === WONE_ADDRESS.toLowerCase()) {
        gasEstimate = await routerContract.removeLiquidityETH.estimateGas(
          lpData.token0.address,
          lpData.balance,
          amountAMin,
          amountBMin,
          userAddress,
          deadline
        );
      } else {
        gasEstimate = await routerContract.removeLiquidity.estimateGas(
          lpData.token0.address,
          lpData.token1.address,
          lpData.balance,
          amountAMin,
          amountBMin,
          userAddress,
          deadline
        );
      }

      return gasEstimate;
    } catch (error) {
      console.warn("[LPRecovery] Erro ao estimar gas:", error);
      return null;
    }
  }
}

// Instância singleton
const lpRecoveryService = new LPRecoveryService();

export default lpRecoveryService;