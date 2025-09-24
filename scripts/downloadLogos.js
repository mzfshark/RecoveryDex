#!/usr/bin/env node
// scripts/downloadLogos.cjs
// CommonJS version: requires 'type': 'module' removed or .cjs extension

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Paths (in CJS __dirname is available)
const TOKEN_LIST_PATH = path.resolve(__dirname, '../src/lists/harmony-tokenlist.json');
const OUTPUT_DIR = path.resolve(__dirname, '../src/assets/logos');

async function downloadLogos() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read token list
  const raw = fs.readFileSync(TOKEN_LIST_PATH, 'utf-8');
  const tokenListJson = JSON.parse(raw);
  const tokens = Array.isArray(tokenListJson)
    ? tokenListJson
    : tokenListJson.tokens || [];

  console.log(`Found ${tokens.length} tokens. Starting logo downloads...`);

  for (const token of tokens) {
    const { symbol, logoURI } = token;
    if (!logoURI) {
      console.warn(`No logoURI for ${symbol}, skipping.`);
      continue;
    }
    try {
      const url = logoURI;
      const ext = path.extname(new URL(url).pathname) || '.png';
      const fileName = `${symbol}${ext}`;
      const filePath = path.join(OUTPUT_DIR, fileName);

      if (fs.existsSync(filePath)) {
        console.log(`${fileName} already exists, skipping.`);
        continue;
      }

      const response = await axios.get(url, { responseType: 'arraybuffer' });
      fs.writeFileSync(filePath, response.data);
      console.log(`Downloaded logo for ${symbol} → ${fileName}`);
    } catch (err) {
      console.error(`Failed to download logo for ${symbol} from ${token.logoURI}:`, err.message);
    }
  }

  console.log('Logo download script completed.');
}

// Run
downloadLogos().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
