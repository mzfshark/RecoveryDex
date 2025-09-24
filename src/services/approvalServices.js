import { ethers } from 'ethers';
import ERC20ABI from '../abis/ERC20ABI.json';
import allowanceCache from './allowanceCache.js';

export async function approveIfNeeded(tokenAddress, aggregatorAddress, signer, amount) {
  try {
    const userAddress = await signer.getAddress();
    
    // First check cache for existing sufficient allowance
    const cachedSufficient = allowanceCache.isSufficient(userAddress, tokenAddress, aggregatorAddress, amount);
    
    if (cachedSufficient === true) {
      console.log('[ApprovalService] Cache hit - approval already sufficient, skipping blockchain call');
      return;
    }
    
    // Cache miss or insufficient - check blockchain
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, signer);
    const allowance = await tokenContract.allowance(userAddress, aggregatorAddress);
    
    // Cache the current allowance (5 minutes TTL for normal allowances)
    allowanceCache.set(userAddress, tokenAddress, aggregatorAddress, allowance);

    if (allowance >= amount) {
      console.log('[ApprovalService] Blockchain check - approval already sufficient');
      return;
    }

    console.log('[ApprovalService] Insufficient allowance, requesting approval...');
    
    // Invalidate cache before approval (will be updated after successful approval)
    allowanceCache.invalidate(userAddress, tokenAddress, aggregatorAddress);
    
    const tx = await tokenContract.approve(aggregatorAddress, ethers.MaxUint256);
    await tx.wait();

    // Cache the new MaxUint256 allowance with longer TTL (30 minutes for max approvals)
    const maxAllowanceTTL = 30 * 60 * 1000; // 30 minutes
    allowanceCache.set(userAddress, tokenAddress, aggregatorAddress, ethers.MaxUint256, maxAllowanceTTL);

    console.log('[ApprovalService] Token approved successfully and cached');
  } catch (error) {
    console.error('[ApprovalService] Approval failed', error);
    
    // Invalidate cache on error to force fresh check next time
    const userAddress = await signer.getAddress().catch(() => null);
    if (userAddress) {
      allowanceCache.invalidate(userAddress, tokenAddress, aggregatorAddress);
    }
    
    throw error;
  }
}
