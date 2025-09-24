const fs = require("fs");
const path = require("path");
// Carrega .env e .env.<tag> (ENV_FILE/NODE_ENV/HARDHAT_NETWORK)
(() => {
    const base = path.join(__dirname, "..", ".env");
    if (fs.existsSync(base)) require("dotenv").config({ path: base });
    const rootBase = path.join(__dirname, "..", "..", ".env");
    if (fs.existsSync(rootBase)) require("dotenv").config({ path: rootBase });
    const tag = process.env.ENV_FILE || process.env.NODE_ENV || process.env.HARDHAT_NETWORK;
    if (tag) {
        const localFile = tag.endsWith(".env") || tag.includes(".env.")
            ? (path.isAbsolute(tag) ? tag : path.join(__dirname, "..", tag))
            : path.join(__dirname, "..", `.env.${tag}`);
        const rootFile = tag.endsWith(".env") || tag.includes(".env.")
            ? (path.isAbsolute(tag) ? tag : path.join(__dirname, "..", "..", tag))
            : path.join(__dirname, "..", "..", `.env.${tag}`);
        if (fs.existsSync(localFile)) require("dotenv").config({ path: localFile, override: true });
        else if (fs.existsSync(rootFile)) require("dotenv").config({ path: rootFile, override: true });
    }
})();

const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Simulating with account:", signer.address);

    const aggregatorAddr = process.env.AGGREGATOR_ADDRESS || process.env.CONTRACT_ADDRESS;
    if (!aggregatorAddr || !ethers.isAddress(aggregatorAddr)) {
        throw new Error("Set AGGREGATOR_ADDRESS (or CONTRACT_ADDRESS) with a valid address of AggregatorMultiSplit");
    }

    const tokenIn = process.env.TOKEN_IN || "";
    const tokenOut = process.env.TOKEN_OUT || "";
    if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
        throw new Error("Set TOKEN_IN and TOKEN_OUT with valid token addresses");
    }

    const amountStr = process.env.AMOUNT_IN || "1.0"; // em unidades de 18 decimais por padrão
    const amountIn = ethers.parseUnits(amountStr, 18);
    const extras = (process.env.EXTRA_INTERMEDIATES || "").split(",").map(s => s.trim()).filter(a => a && ethers.isAddress(a));

    const aggregator = await ethers.getContractAt("AggregatorMultiSplit", aggregatorAddr);
    console.log("Querying quote...", { aggregator: aggregatorAddr, tokenIn, tokenOut, parts: extras.length });
    const [bestOut, bestRouter, bestPath] = await aggregator.quote(amountIn, tokenIn, tokenOut, extras);

    if (bestOut === 0n || bestRouter === ethers.ZeroAddress) {
        console.log("No route found (bestOut=0). Try different tokens/amounts or add EXTRA_INTERMEDIATES.");
        return;
    }

    console.log("Best router:", bestRouter);
    console.log("Best path:", bestPath);
    console.log("Best out (raw):", bestOut.toString());
    console.log("Best out (approx 18d):", ethers.formatUnits(bestOut, 18));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});