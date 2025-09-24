# RecoverySwap — DEX Aggregator (Uniswap V2 forks)

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/a2cdd664b12c49879432435467dbcd89)](https://app.codacy.com/gh/ThinkinCoin/RecoverySwap/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

RecoverySwap é um agregador de DEXs que encontra a melhor rota de swap entre pares ERC-20, com suporte a múltiplos routers Uniswap V2, controle de slippage, taxa fixa (feeBps) e integração de carteira via Reown AppKit.

• Contratos: `contracts/AggregatorV2.sol`
• Frontend: React + Vite + ethers v6 + wagmi + Reown AppKit
• Deploy/Testes: Hardhat (scripts em `scripts/` e testes em `test/`)

Saiba mais nos docs em `./docs/`:

- Visão geral e arquitetura: docs/arquitetura.md
- Componentes (UI): docs/componentes.md
- Hooks: docs/hooks.md
- Serviços (web3 e utilitários): docs/servicos.md
- Contrato AggregatorV2: docs/contratos.md
- Guia de setup/execução: docs/setup.md
- Guia de administração (fees/routers/WETH): docs/admin.md
- Automação com Copilot (Coding Agent): docs/copilot-agent.md

## Sumário rápido

- Melhor rota on-chain e off-chain (quote + swap)
- Suporte a caminhos com intermediários (até 3 hops)
- Slippage controlado e variantes com path/minOut
- Taxa fixa configurável (feeBps) com teto MAX_FEE_BPS
- Suporte a WETH/ETH em swaps nativos
- UI resiliente com ErrorBoundary, WalletConnect via Reown AppKit

## Requisitos

- Node.js 20+
- pnpm 10+ (recomendado) ou npm/yarn
- Carteira EVM (MetaMask ou compatíveis via Reown AppKit)
- RPC Harmony para leitura/escrita (ou outra rede compatível se adaptar)

## Variáveis de ambiente

Crie um arquivo `.env` na raiz com:

- VITE_REOWN_PROJECT_ID=seu_project_id_reown
- VITE_RPC_URL_HARMONY=<https://api.harmony.one> (ou seu RPC)
- VITE_AGGREGATOR_ADDRESS=0x...

Opcional (deploy Hardhat):
- FEE_BPS=25 (taxa padrão em bps para o construtor)
- WETH_ADDRESS=0x... (para setWETH pós-deploy)

## Como rodar (frontend)

Instale dependências e rode o dev server:

```sh
pnpm install
pnpm dev
```

Build de produção e preview local:

```sh
pnpm build
pnpm preview
```

## Hardhat (compilar, testar, deploy)

Compilar contratos:

```sh
pnpm compile
```

Executar testes:

```sh
pnpm hardhat-test
```

Deploy (exemplo Harmony configurado no hardhat.config):

```sh
pnpm deploy:harmony
```

Mais detalhes em `docs/setup.md` e `scripts/deploy.js`.

## Estrutura do projeto (alto nível)

- contracts/ — Solidity (AggregatorV2, libs, mocks)
- scripts/ — Deploy/auxiliares Hardhat
- src/
	- components/ — UI atômica (WalletConnect, Swap, etc.)
	- layouts/ — Formulários/containers (SwapForm, Header, etc.)
	- hooks/ — Lógica reutilizável (rotas, slippage, oracle)
	- services/ — Chamadas de contrato, utilitários (aggregatorService, approvals, etc.)
	- context/ — `ContractContext` (provider, signer, contratos)
	- web3/ — `appkit.js` (bootstrap Reown AppKit)
	- abis/ — JSON ABIs

## Automação com Copilot (Coding Agent)

Para executar tarefas maiores automaticamente (criar branch, aplicar mudanças e abrir PR), use o “Copilot Coding Agent”. O guia completo está em `docs/copilot-agent.md`. Resumo:

1) Ative o GitHub Copilot Chat no VS Code e autentique-se.
2) Abra este repositório no VS Code.
3) No chat do Copilot, descreva a tarefa e inclua a tag:
	 `#github-pull-request_copilot-coding-agent`
4) O agente criará uma branch, implementará a tarefa e abrirá um PR.

## Licença

MIT — veja `LICENSE.md`.

## Suporte

Abra issues ou PRs. Consulte os documentos em `docs/` para detalhes de arquitetura, APIs e troubleshooting.

## Deploy (produção)

### Produção: Frontend na Vercel + Google API Gateway (recomendado)

O frontend deve apontar para o Google API Gateway que expõe a API externa (por exemplo, `https://dex-monitor-839js5ts.uc.gateway.dev`).
No ambiente de produção, usamos o Gateway para rotear requisições para `https://whostler.com/api/`.

Variáveis de ambiente úteis (exemplo .env):

```env
# Google GCP API Gateway
VITE_API_GATEWAY_URL=https://dex-monitor-839js5ts.uc.gateway.dev
VITE_API_KEY=AIzaSyCxJ7ZpVbZXGpOk6dMjerLq9jzihWOKAws
VITE_API_TIMEOUT=10000
VITE_API_RETRY_COUNT=3
```

- Configure na Vercel um rewrite para que chamadas internas ao frontend para `/api/*` sejam encaminhadas ao Gateway (opcional — o frontend já usa o `VITE_API_GATEWAY_URL`):

```json
{
	"rewrites": [
		{ "source": "/api/(.*)", "destination": "https://dex-monitor-839js5ts.uc.gateway.dev/api/$1" }
	]
}
```

Uso em frontend
- O app continua chamando `fetch('/api/liquidity')` e `fetch('/api/health')` durante o desenvolvimento. Em produção, o `VITE_API_GATEWAY_URL` deve apontar para o Gateway. Se você preferir apontar diretamente para o backend, defina `VITE_API_GATEWAY_URL=https://whostler.com`.

Segurança
- Se o Gateway exigir chave de API, envie o header `x-api-key: <VITE_API_KEY>` nas requisições.

Observação: A pasta `server/` e o servidor Express foram removidos do fluxo de desenvolvimento — a API agora é uma dependência externa gerenciada fora deste código. Se o diretório `server/` ainda existir localmente no repositório, remova-o com os comandos abaixo (execute na raiz do repositório):

Linux / macOS / WSL:

```sh
git rm -r server/
git commit -m "chore: remove internal server"
git push
```

Windows (PowerShell):

```powershell
git rm -r server/
git commit -m "chore: remove internal server"
git push
```

ou execute os scripts preparados em `scripts/remove-server.sh` ou `scripts/remove-server.ps1`.