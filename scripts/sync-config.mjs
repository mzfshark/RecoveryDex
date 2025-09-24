// scripts/sync-config.mjs
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfgPath = resolve(__dirname, "../src/config/routers.json");
const netPath = resolve(__dirname, "../src/config/network.json");
const abiPath = resolve(__dirname, "../src/abis/Aggregator.json");
const AggregatorABI = JSON.parse(readFileSync(abiPath, "utf8"));

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error("[sync-config] Failed to read JSON:", path, err);
    process.exit(1);
  }
}

async function main() {
  const config = loadJson(cfgPath);
  const network = loadJson(netPath);
  const address = process.env.VITE_AGGREGATOR_ADDRESS;
  if (!address || !ethers.isAddress(address)) {
    console.error("[sync-config] Invalid VITE_AGGREGATOR_ADDRESS env var");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(network.rpcURL);
  let liveChainId;
  try {
    ({ chainId: liveChainId } = await provider.getNetwork());
  } catch (err) {
    console.error("[sync-config] Failed to fetch network:", err);
    process.exit(1);
  }
  if (Number(network.chainId) !== Number(liveChainId)) {
    console.error(
      `[sync-config] chainId mismatch → config: ${network.chainId} | provider: ${liveChainId}`
    );
    process.exit(1);
  }

  const contract = new ethers.Contract(address, AggregatorABI, provider);
  const localRouters = (config.routers || []).map((r) => r.address.toLowerCase());
  let onChain = [];

  let arrayFns = [];
  try {
    arrayFns = Object.values(contract.interface.functions || {})
      .filter((fn) => fn.outputs?.length === 1 && fn.outputs[0].type === "address[]")
      .map((fn) => fn.name);
  } catch { /* empty */ }

  if (arrayFns.length > 0) {
    try {
      const result = await contract[arrayFns[0]]();
      if (Array.isArray(result) && result.length > 0) {
        onChain = result.map((a) => a.toLowerCase());
      }
    } catch {}
  }

  if (onChain.length === 0 && typeof contract.routerCount === 'function' && typeof contract.routerAt === 'function') {
    try {
      const count = Number(await contract.routerCount());
      const arr = await Promise.all(
        Array.from({ length: count }).map((_, i) => contract.routerAt(i))
      );
      onChain = arr.map((a) => a.toLowerCase());
    } catch {}
  }

  if (onChain.length === 0 && typeof contract.routers === 'function') {
    const approved = [];
    for (const r of localRouters) {
      try {
        const ok = await contract.routers(r);
        if (ok) approved.push(r);
      } catch {}
    }
    onChain = approved;
  }

  if (onChain.length === 0) {
    console.error('[sync-config] No usable whitelist accessor returned a result from Aggregator ABI');
    process.exit(1);
  }

  const missing = localRouters.filter((a) => !onChain.includes(a));
  if (missing.length) {
    console.error(
      '[sync-config] Routers missing in contract whitelist:\n' + missing.join('\n')
    );
    process.exit(1);
  }

  console.log('[sync-config] ✅ Config files are in sync with on‑chain data.');
}

main().catch((err) => {
  console.error('[sync-config] Unexpected error:', err);
  process.exit(1);
});
