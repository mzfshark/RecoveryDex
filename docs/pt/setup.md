# Setup e Execução

Este guia cobre do zero ao funcionamento do RecoveryDex.

## Requisitos
- Node.js 20+
- pnpm 10+ (ou npm/yarn)
- Carteira EVM (MetaMask ou compatíveis via Reown AppKit)
- RPC Harmony (ou rede equivalente se adaptar)

## Variáveis de ambiente (.env)
Crie um arquivo `.env` na raiz com:

```
VITE_REOWN_PROJECT_ID=<seu_project_id_reown>
VITE_RPC_URL_HARMONY=<url_do_rpc>
VITE_AGGREGATOR_ADDRESS=<endereco_do_contrato_AggregatorV2>
```

Opcional para deploy via Hardhat:
```
FEE_BPS=25
WETH_ADDRESS=<endereco_WETH>
```

## Instalação
```
pnpm install
```

## Rodar o Frontend (Vite)
```
pnpm dev
```
- Servidor inicia normalmente (porta padrão do Vite). Caso a porta esteja ocupada, o Vite ajusta automaticamente.

Build de produção e preview local:
```
pnpm build
pnpm preview
```

## Hardhat (Contratos)
- Compilar: `pnpm compile`
- Testar: `pnpm hardhat-test`
- Deploy (Harmony): `pnpm deploy:harmony`

Ajuste `hardhat.config.js`/`ts` conforme chaves e redes.

## Checagem de Tipos (TypeScript)
- App (Vite/React): `pnpm typecheck`
- Hardhat (scripts/testes): `pnpm typecheck:hardhat`

Observação: o projeto usa tsconfigs separados:
- `tsconfig.json`: foco no app (Vite/React)
- `tsconfig.hardhat.json`: foco em scripts/testes do Hardhat

Se o editor ainda mostrar avisos de tipos, reinicie o TS Server no VS Code (Command Palette > "TypeScript: Restart TS server").

## Wallet (Reown AppKit)
- O AppKit é inicializado em `src/web3/appkit.js` com a rede Harmony.
- O botão de conexão `<appkit-button />` é usado em `src/components/WalletConnect.jsx`.
- `ContractContext.jsx` cria provider/signer e instâncias do contrato (read/write) usando hooks do AppKit.

## Troubleshooting
- Variáveis ausentes: confira `.env`.
- Carteira não conecta: verifique `VITE_REOWN_PROJECT_ID` e o provedor instalado (MetaMask etc.).
- Quote ou Swap falham: verifique `VITE_AGGREGATOR_ADDRESS`, rede e liquidez disponível nos routers.
