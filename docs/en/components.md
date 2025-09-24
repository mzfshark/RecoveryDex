# Components (UI)

Description of the main components under `src/components` and `src/layouts`.

## Components
- `App.jsx`: Application shell; loads layout and pages.
- `ErrorBoundary.jsx`: Captures render errors to avoid white screens.
- `WalletConnect.jsx`: Shows `<appkit-button />` to connect/disconnect wallet; displays address/balance when available.
- `Swap.jsx`: Simplified swap page; uses `quoteBestRoute` and executes swaps; converts amount with `parseUnits`.
- `LiquidityDashboard.jsx`: (if applicable) charts/liquidity views.
- `Loading.jsx`, `Alert.jsx`, `Transactions.jsx`, `ThemeToggle.jsx`, `Navigation.jsx`: UI utilities.
- `NetworkSelector.tsx`: network selector (optional/future) integrated with AppKit.

## Layouts
- `SwapForm.jsx`: Main swap form; performs conditional approve and swap via services; calculates minOut and impacts.
- `Header.jsx`, `Footer.jsx`, `Layout.jsx`, `Content.jsx`, `Logo.jsx`, `card.jsx`: visual composition.
- `TokenSelector.jsx`: selection of input/output tokens.
- `UserSettings.jsx`, `Profile.jsx`: user preferences (theme, tolerance, etc.).

## Good practices adopted
- Amount conversion: `parseUnits` to send to the contract and `formatUnits` to display to the user.
- Debounce quotes to avoid RPC spam.
- `AbortController` to cancel previous quotes.
- Error handling with `ErrorBoundary` and friendly Alerts.
