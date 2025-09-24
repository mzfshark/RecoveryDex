---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "RecoveryDex"
  text: "DeFi Aggregator Documentation"
  tagline: "Comprehensive guide for depegged token recovery and DEX aggregation"
  image:
    src: ./logo.png
    alt: RecoveryDex Logo
  actions:
    - theme: brand
      text: Get Started
      link: ./setup
    - theme: alt
      text: View Architecture
      link: ./architecture

features:
  - title: 🚀 Performance Optimized
    details: Advanced allowance caching system reduces blockchain queries by 70%, providing instant swap verifications for previously approved tokens.
  
  - title: 🔗 Multi-Router Aggregation
    details: Intelligent routing across multiple DEXs to find the best rates for depegged token recovery with minimal slippage.
  
  - title: 📊 Real-time Monitoring
    details: External API integration provides persistent transaction history and real-time updates without RPC limitations.
  
  - title: 🛡️ Security First
    details: Comprehensive error handling, input validation, and secure smart contract integrations with extensive testing coverage.
  
  - title: 🎯 User Experience
    details: Intuitive React components with responsive design, loading states, and contextual error messages for seamless interactions.
  
  - title: 🔧 Developer Friendly
    details: Well-documented APIs, TypeScript support, extensive debugging tools, and modular architecture for easy maintenance.
---

## Quick Links

::: tip Getting Started
New to RecoveryDex? Start with our [Setup Guide](./setup) to get up and running in minutes.
:::

::: info Architecture
Learn about the system design and core concepts in our [Architecture Overview](./architecture).
:::

::: details Advanced Features
Explore our advanced features like [Allowance Caching](./allowance-cache) and [External API Integration](./transactions-api).
:::

## What's RecoveryDex?

RecoveryDex is a sophisticated DeFi aggregator designed specifically for **depegged token recovery**. It combines intelligent routing across multiple DEX protocols with advanced performance optimizations to help users recover maximum value from their depegged tokens.

### Key Capabilities

- **Multi-Protocol Routing**: Aggregates liquidity from Uniswap V2, SushiSwap, and other compatible DEXs
- **Intelligent Caching**: Revolutionary allowance cache system eliminates redundant blockchain queries  
- **Real-time Analytics**: Persistent transaction tracking via external API integration
- **Security-First**: Extensive testing, input validation, and secure contract interactions

### Perfect For

- **DeFi Users**: Recovering value from depegged stablecoins and tokens
- **Developers**: Building on top of RecoveryDex's modular architecture
- **Integrators**: Adding recovery functionality to existing DeFi applications

---

<div class="tip custom-block" style="padding-top: 8px">

Ready to dive in? Check out the [Components Guide](./components) or explore our [Smart Contracts](./contracts) documentation.

</div>