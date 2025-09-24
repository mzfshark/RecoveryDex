# Componentes (UI)

Descrição dos principais componentes em `src/components` e `src/layouts`.

## Componentes
- `App.jsx`: Shell da aplicação; carrega layout e páginas.
- `ErrorBoundary.jsx`: Captura erros de renderização para evitar tela branca.
- `WalletConnect.jsx`: Mostra `<appkit-button />` para conectar/disconnectar carteira; exibe endereço/saldo quando disponível.
- `Swap.jsx`: Página de swap simplificada; utiliza `quoteBestRoute` e executa swaps; converte amount com `parseUnits`.
- `LiquidityDashboard.jsx`: (se aplicado) gráficos/visões de liquidez.
- `Loading.jsx`, `Alert.jsx`, `Transactions.jsx`, `ThemeToggle.jsx`, `Navigation.jsx`: utilitários de UI.
- `NetworkSelector.tsx`: seletor de rede (opcional / futuro) integrado ao AppKit.

## Layouts
- `SwapForm.jsx`: Form principal do swap; faz approve condicional e executa swap via serviços; calcula minOut e impactos.
- `Header.jsx`, `Footer.jsx`, `Layout.jsx`, `Content.jsx`, `Logo.jsx`, `card.jsx`: composição visual.
- `TokenSelector.jsx`: seleção de tokens de entrada/saída.
- `UserSettings.jsx`, `Profile.jsx`: preferências do usuário (tema, tolerância etc.).

## Boas práticas adotadas
- Conversão de quantias: `parseUnits` para enviar ao contrato e `formatUnits` para exibir ao usuário.
- Debounce em quotes para evitar spam de RPC.
- `AbortController` para cancelar quotes anteriores.
- Tratamento de erros com `ErrorBoundary` e Alerts amigáveis.
