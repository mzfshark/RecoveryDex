// scripts/benchmarkAggregator.mjs
import fs from "fs";
import { performance } from "perf_hooks";
import { ethers } from "ethers";
import path from "path";
import { fileURLToPath } from "url";
import quoteBestRoute from "../src/services/aggregatorService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tokenListPath = path.resolve(__dirname, "../src/assets/tokenlist.json");
const tokenListRaw = fs.readFileSync(tokenListPath, { encoding: "utf8" });
const tokenList = JSON.parse(tokenListRaw);

const iterations = 100;
const testAmount = ethers.parseUnits("1.0", 18);

function pickRandomToken(exclude = []) {
  const list = tokenList.tokens.filter(t => t.address && !exclude.includes(t.address));
  return list[Math.floor(Math.random() * list.length)];
}

async function runBenchmark() {
  let totalTime = 0;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < iterations; i++) {
    const tokenIn = pickRandomToken();
    const tokenOut = pickRandomToken([tokenIn.address]);
    const inter = tokenList.tokens.map(t => t.address).filter(addr => addr !== tokenIn.address && addr !== tokenOut.address);

    const start = performance.now();
    try {
      const result = await quoteBestRoute(testAmount, tokenIn.address, tokenOut.address, inter);
      const duration = performance.now() - start;

      if (result && result.bestOut && result.routerAddr) {
        console.log(`#${i + 1} ✅ Route found in ${duration.toFixed(2)} ms | router: ${result.routerAddr}`);
        totalTime += duration;
        successCount++;
      } else {
        console.warn(`#${i + 1} ⚠️ No route found (${tokenIn.symbol} → ${tokenOut.symbol})`);
        failureCount++;
      }
    } catch (err) {
      const duration = performance.now() - start;
      console.error(`#${i + 1} ❌ Error in ${duration.toFixed(2)} ms:`, err.message);
      failureCount++;
    }
  }

  const avg = successCount ? (totalTime / successCount).toFixed(2) : 0;
  console.log("\n📊 Benchmark Complete:");
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`⏱️ Average Response Time: ${avg} ms`);
}

runBenchmark().catch(console.error);
