// src/services/lpRecoveryService.js
import { ethers } from "ethers";
import { getProvider } from "./provider.js";
import { notify } from "./notificationService.js";
import factoryList from "../factory.json";
import ERC20ABI from "../abis/ERC20ABI.json";
import blockscoutService from "./blockscoutService.js";

// Minimal required ABIs
const UNISWAP_V2_PAIR_ABI = [
  // Query functions
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  
  // Liquidity removal functions
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function burn(address to) returns (uint256 amount0, uint256 amount1)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)"
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

// Known router addresses for each factory
const FACTORY_TO_ROUTER = {
  "0x7D02c116b98d0965ba7B642ace0183ad8b8D2196": "0xf012702a5f0e54015362cBCA26a26fc90AA832a3", // ViperSwap
  "0xc35DADB65012eC5796536bD9864eD8773aBc74C4": "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // SushiSwap
  "0x9014B937069918bd319f80e8B3BB4A2cf6FAA5F7": "0x24ad62502d1C652Cc7684081169D04896aC20f30", // DFK
  "0xF166939E9130b03f721B0aE5352CCCa690a7726a": "0x3E9CD1f4eF9C5c7C7C0d36B71D574042f0cE4174", // Defira
};

// Fallback router address (ViperSwap router - most compatible on Harmony)
const FALLBACK_ROUTER = "0xf012702a5f0e54015362cBCA26a26fc90AA832a3";

const WONE_ADDRESS = "0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a";

/**
 * Class for managing LP recovery
 */
class LPRecoveryService {
  constructor() {
    this.provider = null;
    this.signer = null;
  }

  /**
   * Initialize the service with provider and signer
   */
  async initialize(signer = null) {
    this.provider = getProvider();
    this.signer = signer;
    
    if (!this.provider) {
      throw new Error("Provider not available");
    }
  }

  /**
   * Search for all LPs that the user owns
   */
  async getUserLPs(userAddress) {
    if (!ethers.isAddress(userAddress)) {
      throw new Error("Invalid address");
    }

    notify.info("Searching", "Looking for user's LPs...", 5000);
    
    const userLPs = [];
    const factories = Object.values(factoryList.UNISWAP.FACTORY);

    try {
      // For each factory, search all pairs and check if user has LP tokens
      for (const factoryAddress of factories) {
        console.log(`[LPRecovery] Checking factory: ${factoryAddress}`);
        
        try {
          const factoryContract = new ethers.Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, this.provider);
          
          // Get total number of pairs
          const totalPairs = await factoryContract.allPairsLength();
          console.log(`[LPRecovery] Total pairs in factory ${factoryAddress}: ${totalPairs}`);
          
          // Check first 100 pairs (optimization to avoid timeout)
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
              console.warn(`[LPRecovery] Error checking pair ${i}:`, error.message);
            }
            
            // Small delay to avoid rate limiting
            if (i % 10 === 0 && i > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } catch (error) {
          console.warn(`[LPRecovery] Error in factory ${factoryAddress}:`, error.message);
        }
      }

      notify.success("Found", `${userLPs.length} LP(s) found`, 3000);
      return userLPs;
    } catch (error) {
      console.error("[LPRecovery] Error searching LPs:", error);
      notify.error("Error", "Error searching LPs: " + error.message);
      throw error;
    }
  }

  /**
   * Check user's LP token balance in a specific pair
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

      // Get token information
      const token0Contract = new ethers.Contract(token0, ERC20ABI, this.provider);
      const token1Contract = new ethers.Contract(token1, ERC20ABI, this.provider);
      
      const [token0Symbol, token1Symbol, token0Decimals, token1Decimals] = await Promise.all([
        token0Contract.symbol(),
        token1Contract.symbol(),
        token0Contract.decimals(),
        token1Contract.decimals()
      ]);

      // Calculate amount of tokens user will receive with higher precision
      // Use 1e18 multiplier for better precision with small balances
      const PRECISION = 1000000000000000000n; // 1e18
      const userShare = (balance * PRECISION) / totalSupply;
      const token0Amount = (reserves.reserve0 * userShare) / PRECISION;
      const token1Amount = (reserves.reserve1 * userShare) / PRECISION;

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
        userShare: Number(userShare * 100n / PRECISION) / 100, // percentage
        formattedBalance: ethers.formatUnits(balance, 18)
      };
    } catch (error) {
      console.warn(`[LPRecovery] Error checking pair ${pairAddress}:`, error.message);
      return { balance: 0n, pairAddress };
    }
  }

  /**
   * Remove liquidity from a specific pair
   */
  async removeLiquidity(lpData, slippage = 5) {
    if (!this.signer) {
      throw new Error("Signer required to remove liquidity");
    }

    // Try to get specific router, fallback to ViperSwap router if not found
    let routerAddress = FACTORY_TO_ROUTER[lpData.factoryAddress];
    if (!routerAddress) {
      console.warn(`[LPRecovery] Router not found for factory ${lpData.factoryAddress}, using fallback router`);
      routerAddress = FALLBACK_ROUTER;
      notify.info("Info", "Using fallback router for this LP removal", 5000);
    }

    try {
      notify.info("Processing", "Removing liquidity...", 10000);

      const routerContract = new ethers.Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, this.signer);
      const pairContract = new ethers.Contract(lpData.pairAddress, UNISWAP_V2_PAIR_ABI, this.signer);
      
      const userAddress = await this.signer.getAddress();
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes

      // Check and approve LP tokens for the router
      const allowance = await pairContract.allowance(userAddress, routerAddress);
      if (allowance < lpData.balance) {
        notify.info("Approving", "Approving LP tokens...", 5000);
        const approveTx = await pairContract.approve(routerAddress, lpData.balance);
        await approveTx.wait();
      }

      // Calculate minimums with slippage
      const slippageMultiplier = (100 - slippage) * 100n; // For 5% = 9500
      const amountAMin = (lpData.token0.amount * slippageMultiplier) / 10000n;
      const amountBMin = (lpData.token1.amount * slippageMultiplier) / 10000n;

      let tx;
      // Check if one of the tokens is WONE (native ONE)
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

      notify.info("Confirming", "Waiting for transaction confirmation...", 15000);
      const receipt = await tx.wait();
      
      notify.success("Success", `Liquidity removed! Hash: ${receipt.hash.slice(0, 10)}...`, 5000);
      return receipt;
    } catch (error) {
      console.error("[LPRecovery] Router method failed:", error);
      
      // Try direct burn method as fallback
      try {
        console.log("[LPRecovery] Attempting direct burn method...");
        notify.info("Retrying", "Trying alternative removal method...", 5000);
        
        const pairContract = new ethers.Contract(lpData.pairAddress, UNISWAP_V2_PAIR_ABI, this.signer);
        const userAddress = await this.signer.getAddress();
        
        // Transfer LP tokens to the pair contract
        const transferTx = await pairContract.transfer(lpData.pairAddress, lpData.balance);
        await transferTx.wait();
        
        // Burn the tokens to get underlying tokens back
        const burnTx = await pairContract.burn(userAddress);
        const receipt = await burnTx.wait();
        
        notify.success("Success", `Liquidity removed via burn! Hash: ${receipt.hash.slice(0, 10)}...`, 5000);
        return receipt;
      } catch (burnError) {
        console.error("[LPRecovery] Direct burn also failed:", burnError);
        notify.error("Error", "All removal methods failed: " + burnError.message);
        throw burnError;
      }
    }
  }

  /**
   * Remove liquidity from multiple pairs
   */
  async removeLiquidityBatch(lpDataList, slippage = 5) {
    const results = [];
    
    for (let i = 0; i < lpDataList.length; i++) {
      try {
        notify.info("Progress", `Removing LP ${i + 1} of ${lpDataList.length}`, 3000);
        const result = await this.removeLiquidity(lpDataList[i], slippage);
        results.push({ success: true, result, lpData: lpDataList[i] });
        
        // Small delay between transactions
        if (i < lpDataList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`[LPRecovery] Error on LP ${i}:`, error);
        results.push({ success: false, error: error.message, lpData: lpDataList[i] });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    notify.success("Completed", `${successful}/${lpDataList.length} LPs removed successfully`, 5000);
    
    return results;
  }

  /**
   * Get factory name based on address
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
   * Estimate gas for liquidity removal
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
      console.warn("[LPRecovery] Error estimating gas:", error);
      return null;
    }
  }

  /**
   * Optimized method: Get user LPs using Blockscout API
   * Much faster than scanning all pairs - only validates user's actual tokens
   */
  async getUserLPsOptimized(userAddress, onProgress = null) {
    if (!ethers.isAddress(userAddress)) {
      throw new Error("Invalid address");
    }

    console.log(`[LPRecovery] Starting optimized LP discovery for ${userAddress}`);
    
    if (onProgress) {
      onProgress({
        currentDex: 'Blockscout API',
        currentDexIndex: 1,
        totalDexs: 1,
        foundLPs: 0,
        currentPair: 0,
        totalPairsInDex: 0,
        maxPairsToCheck: 0,
        pairsChecked: 0,
        isSearching: true
      });
    }
    
    try {
      // Step 1: Get potential LP tokens from Blockscout
      const potentialLPs = await blockscoutService.getLPTokensForAddress(userAddress);
      
      if (potentialLPs.length === 0) {
        console.log('[LPRecovery] No LP tokens found in wallet via Blockscout');
        notify.info("Info", "No LP tokens found in wallet", 3000);
        return [];
      }
      
      console.log(`[LPRecovery] Found ${potentialLPs.length} potential LP tokens, validating...`);
      notify.info("Processing", `Validating ${potentialLPs.length} potential LP tokens...`, 3000);
      
      // Step 2: Validate and get details for each LP
      const validatedLPs = [];
      const factories = Object.entries(factoryList.UNISWAP.FACTORY);
      
      // Update progress with validation info
      if (onProgress) {
        onProgress({
          currentDex: 'Validating LPs',
          currentDexIndex: 1,
          totalDexs: 1,
          foundLPs: 0,
          currentPair: 0,
          totalPairsInDex: potentialLPs.length,
          maxPairsToCheck: potentialLPs.length,
          pairsChecked: 0,
          isSearching: true
        });
      }
      
      for (let i = 0; i < potentialLPs.length; i++) {
        const lpToken = potentialLPs[i];
        
        // Update progress
        if (onProgress) {
          onProgress({
            currentDex: 'Validating LPs',
            currentDexIndex: 1,
            totalDexs: 1,
            foundLPs: validatedLPs.length,
            currentPair: i + 1,
            totalPairsInDex: potentialLPs.length,
            maxPairsToCheck: potentialLPs.length,
            pairsChecked: i + 1,
            isSearching: true
          });
        }
        
        try {
          console.log(`[LPRecovery] Validating ${lpToken.symbol} (${lpToken.address})`);
          
          // Try to create pair contract and validate it's a real LP
          const pairContract = new ethers.Contract(lpToken.address, UNISWAP_V2_PAIR_ABI, this.provider);
          
          // Check if it's a valid pair contract by trying to get pair info
          const [token0, token1, reserves, balance, totalSupply, symbol] = await Promise.all([
            pairContract.token0(),
            pairContract.token1(), 
            pairContract.getReserves(),
            pairContract.balanceOf(userAddress),
            pairContract.totalSupply(),
            pairContract.symbol()
          ]);
          
          // Skip if user has no balance
          if (balance === 0n) {
            console.log(`[LPRecovery] ❌ No balance in ${lpToken.symbol}`);
            continue;
          }
          
          // Find which factory this pair belongs to
          let factoryAddress = null;
          let factoryName = null;
          
          for (const [name, address] of factories) {
            try {
              const factoryContract = new ethers.Contract(address, UNISWAP_V2_FACTORY_ABI, this.provider);
              const expectedPair = await factoryContract.getPair(token0, token1);
              
              if (expectedPair.toLowerCase() === lpToken.address.toLowerCase()) {
                factoryAddress = address;
                factoryName = name;
                break;
              }
            } catch (e) {
              // Continue to next factory
            }
          }
          
          if (factoryAddress) {
            // Get token details
            const token0Contract = new ethers.Contract(token0, ERC20ABI, this.provider);
            const token1Contract = new ethers.Contract(token1, ERC20ABI, this.provider);
            
            const [token0Symbol, token1Symbol, token0Decimals, token1Decimals] = await Promise.all([
              token0Contract.symbol(),
              token1Contract.symbol(),
              token0Contract.decimals(),
              token1Contract.decimals()
            ]);
            
            // Calculate user share and token amounts with high precision
            const PRECISION = 1000000000000000000n; // 1e18
            const userShare = (balance * PRECISION) / totalSupply;
            const token0Amount = (reserves.reserve0 * userShare) / PRECISION;
            const token1Amount = (reserves.reserve1 * userShare) / PRECISION;
            
            const lpData = {
              pairAddress: lpToken.address,
              factoryAddress,
              factoryName,
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
              userShare: Number(userShare * 100n / PRECISION) / 100, // percentage
              formattedBalance: ethers.formatUnits(balance, 18)
            };
            
            validatedLPs.push(lpData);
            console.log(`[LPRecovery] ✅ Validated LP: ${token0Symbol}/${token1Symbol} on ${factoryName}`);
          } else {
            console.log(`[LPRecovery] ❌ Could not find factory for LP: ${lpToken.symbol} (${lpToken.address})`);
          }
          
        } catch (error) {
          console.log(`[LPRecovery] ❌ Failed to validate LP ${lpToken.symbol}:`, error.message);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Final progress update
      if (onProgress) {
        onProgress({
          currentDex: 'Complete',
          currentDexIndex: 1,
          totalDexs: 1,
          foundLPs: validatedLPs.length,
          currentPair: potentialLPs.length,
          totalPairsInDex: potentialLPs.length,
          maxPairsToCheck: potentialLPs.length,
          pairsChecked: potentialLPs.length,
          isSearching: false
        });
      }
      
      console.log(`[LPRecovery] ✅ Optimized discovery completed: ${validatedLPs.length} valid LPs found`);
      
      if (validatedLPs.length > 0) {
        notify.success("Found", `${validatedLPs.length} LP(s) found using optimized method`, 3000);
      } else {
        notify.info("Info", "No valid LP tokens found", 3000);
      }
      
      return validatedLPs;
      
    } catch (error) {
      console.error('[LPRecovery] Error in optimized LP discovery:', error);
      throw error;
    }
  }

  /**
   * Search for all LPs that the user owns with progress callbacks
   */
  async getUserLPsWithProgress(userAddress, onProgress, filteredDexs = null) {
    if (!ethers.isAddress(userAddress)) {
      throw new Error("Invalid address");
    }

    notify.info("Searching", "Looking for user's LPs...", 5000);
    
    const userLPs = [];
    
    // Filter DEXs if provided
    let factoriesToSearch = [];
    let factoryNamesToSearch = [];
    
    if (filteredDexs && filteredDexs.length > 0) {
      // Use only filtered DEXs
      factoryNamesToSearch = filteredDexs;
      factoriesToSearch = filteredDexs.map(dexName => factoryList.UNISWAP.FACTORY[dexName]);
    } else {
      // Use all DEXs
      factoryNamesToSearch = Object.keys(factoryList.UNISWAP.FACTORY);
      factoriesToSearch = Object.values(factoryList.UNISWAP.FACTORY);
    }

    try {
      // For each factory, search all pairs and check if user has LP tokens
      for (let factoryIndex = 0; factoryIndex < factoriesToSearch.length; factoryIndex++) {
        const factoryAddress = factoriesToSearch[factoryIndex];
        const factoryName = factoryNamesToSearch[factoryIndex];
        
        // Update progress - starting new DEX
        onProgress({
          currentDex: factoryName,
          currentDexIndex: factoryIndex + 1,
          foundLPs: userLPs.length
        });
        
        console.log(`[LPRecovery] Checking factory: ${factoryAddress} (${factoryName})`);
        
        try {
          const factoryContract = new ethers.Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, this.provider);
          
          // Get total number of pairs
          const totalPairs = await factoryContract.allPairsLength();
          const totalPairsNumber = Number(totalPairs);
          console.log(`[LPRecovery] Total pairs in factory ${factoryAddress}: ${totalPairsNumber}`);
          
          // Check first 100 pairs (optimization to avoid timeout)
          const maxPairs = Math.min(totalPairsNumber, 100);
          
          // Update progress with pair info - use real total pairs for progress calculation
          onProgress({
            currentDex: factoryName,
            currentDexIndex: factoryIndex + 1,
            foundLPs: userLPs.length,
            currentPair: 0,
            totalPairsInDex: totalPairsNumber, // Use real total, not limited
            maxPairsToCheck: maxPairs // Add info about how many we'll actually check
          });
          
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
              
              // Update progress every 5 pairs
              if (i % 5 === 0 || i === maxPairs - 1) {
                onProgress({
                  currentDex: factoryName,
                  currentDexIndex: factoryIndex + 1,
                  foundLPs: userLPs.length,
                  currentPair: i + 1,
                  totalPairsInDex: totalPairsNumber, // Use real total
                  maxPairsToCheck: maxPairs,
                  pairsChecked: i + 1
                });
              }
              
            } catch (error) {
              console.warn(`[LPRecovery] Error checking pair ${i}:`, error.message);
            }
            
            // Small delay to avoid rate limiting
            if (i % 10 === 0 && i > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } catch (error) {
          console.warn(`[LPRecovery] Error in factory ${factoryAddress}:`, error.message);
        }
      }

      // Final progress update
      onProgress({
        currentDex: 'Complete',
        currentDexIndex: factoriesToSearch.length,
        foundLPs: userLPs.length,
        currentPair: 0,
        totalPairsInDex: 0
      });

      notify.success("Found", `${userLPs.length} LP(s) found`, 3000);
      return userLPs;
    } catch (error) {
      console.error("[LPRecovery] Error searching LPs:", error);
      notify.error("Error", "Error searching LPs: " + error.message);
      throw error;
    }
  }
}

// Singleton instance
const lpRecoveryService = new LPRecoveryService();

export default lpRecoveryService;