#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

// Simple .env loader (non-destructive)
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (e) {
    // ignore
  }
}

loadEnv();

const AGG_ADDR = (process.env.VITE_AGGREGATOR_ADDRESS || '').toLowerCase();
if (!AGG_ADDR) {
  console.error('Missing VITE_AGGREGATOR_ADDRESS in env');
  process.exit(1);
}

const RPC = process.env.VITE_RPC_URL_HARMONY || 'https://api.harmony.one';
const provider = new ethers.JsonRpcProvider(RPC);

// Load ABI
const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const abiPath = resolve(process.cwd(), 'src/abis/AggregatorMultiSplit.json');
let abiJson;
try {
  abiJson = JSON.parse(readFileSync(abiPath, 'utf-8'));
} catch (e) {
  console.error('Failed to read ABI at', abiPath, e.message);
  process.exit(1);
}

const contract = new ethers.Contract(AGG_ADDR, abiJson.abi, provider);

// Parameters
const depthArg = process.argv.find(a => a.startsWith('--depth='));
const maxResultsArg = process.argv.find(a => a.startsWith('--max='));
const depth = depthArg ? Number(depthArg.split('=')[1]) : 5000;
const maxResults = maxResultsArg ? Number(maxResultsArg.split('=')[1]) : 20;

(async () => {
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - depth);
  console.log(`[check-events] Latest block: ${latest}`);
  console.log(`[check-events] Querying SwapExecuted from ${fromBlock} to ${latest} (depth=${depth})`);
  try {
    const filter = contract.filters.SwapExecuted();
    const events = await contract.queryFilter(filter, fromBlock, latest);
    console.log(`[check-events] Found ${events.length} SwapExecuted event(s)`);
    for (const ev of events.slice(-maxResults)) {
      const { transactionHash, blockNumber, args } = ev;
      const user = args?.user;
      const router = args?.router;
      const amountIn = args?.amountIn?.toString();
      const amountOut = args?.amountOut?.toString();
      console.log(`  • block=${blockNumber} tx=${transactionHash.slice(0,10)} user=${user} router=${router} in=${amountIn} out=${amountOut}`);
    }
    if (events.length === 0) {
      console.log('No events in this range. Try a larger --depth= value.');
    }
  } catch (e) {
    console.error('[check-events] Error querying events:', e);
    process.exit(2);
  }
})();
