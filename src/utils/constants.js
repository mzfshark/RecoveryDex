// src/utils/constants.js
// Token addresses for fallback intermediates (Harmony network)
export const JEWEL  = '0x72Cb10C6bfA5624dD07Ef608027E366bd690048F';
export const FIRA   = '0x2A719aF848bf365489E548BE5edbEC1D65858e59';
export const VIPER  = '0xEa589E93Ff18b1a1F1e9BaC7EF3E86Ab62addc79';
export const SONIC  = '0x1e05C8B69e4128949FcEf16811a819eF2f55D33E';

// Fallback list of popular intermediate token symbols (not addresses)
export const FALLBACK_INTERMEDIATES = [
  'JEWEL',
  'FIRA', 
  'VIPER',
  'SONIC'
];

export const DEFAULT_SLIPPAGE = 2; // 2%

// Contract fee in basis points (25 BPS = 0.25% as per AggregatorV2.sol)
export const CONTRACT_FEE_BPS = 25; // 0.25%
export const CONTRACT_FEE_PCT = CONTRACT_FEE_BPS / 100; // 0.25%

// Harmony wrapped ONE (WONE) address - usado internamente para representar o token nativo
export const WONE_ADDRESS = '0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a';