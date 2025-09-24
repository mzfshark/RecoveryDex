# Setup and Run

This guide covers everything you need to get RecoveryDex running.

## Requirements
- Node.js 20+
- pnpm 10+ (or npm/yarn)
- EVM wallet (MetaMask or compatibles via Reown AppKit)
- Harmony RPC (or equivalent network if adapted)

## Environment Variables (.env)
Create a `.env` file at the root with:

```
VITE_REOWN_PROJECT_ID=<your_reown_project_id>
VITE_RPC_URL_HARMONY=<rpc_url>
VITE_AGGREGATOR_ADDRESS=<AggregatorV2_contract_address>
```

Optional for Hardhat deploy:
```
FEE_BPS=25
WETH_ADDRESS=<WETH_address>
```

## Install
```
pnpm install
```

## Run Frontend (Vite)
```
pnpm dev
```
- Server starts normally (Vite default port). If the port is busy, Vite will adjust automatically.

Production build and local preview:
```
pnpm build
pnpm preview
```

## Hardhat (Contracts)
- Compile: `pnpm compile`
- Test: `pnpm hardhat-test`
- Deploy (Harmony): `pnpm deploy:harmony`

Adjust `hardhat.config.js`/`ts` according to keys and networks.

## Type Checking (TypeScript)
- App (Vite/React): `pnpm typecheck`
- Hardhat (scripts/tests): `pnpm typecheck:hardhat`

Note: the project uses separate tsconfigs:
- `tsconfig.json`: app focus (Vite/React)
- `tsconfig.hardhat.json`: Hardhat scripts/tests focus

If the editor still shows type warnings, restart the TS Server in VS Code (Command Palette > "TypeScript: Restart TS server").

## Wallet (Reown AppKit)
- AppKit is initialized in `src/web3/appkit.js` with the Harmony network.
- The `<appkit-button />` connect button is used in `src/components/WalletConnect.jsx`.
- `ContractContext.jsx` creates provider/signer and contract instances (read/write) using AppKit hooks.

## Troubleshooting
- Missing variables: check `.env`.
- Wallet not connecting: verify `VITE_REOWN_PROJECT_ID` and installed provider (MetaMask, etc.).
- Quote or Swap failing: check `VITE_AGGREGATOR_ADDRESS`, network, and liquidity on routers.
