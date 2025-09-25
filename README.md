# RecoveryDex - Multi-Split Token Swap Aggregator

RecoveryDex is a comprehensive DeFi platform that combines smart contract aggregation with an intuitive React frontend. The project implements intelligent token swapping on the Harmony network, allowing users to split large transactions (`amountIn`) into multiple smaller operations using intermediate tokens like JEWEL, SONIC, or VIPER to minimize slippage.

## 🌟 Features

- **Multi-Split Aggregation**: Automatically splits large trades into smaller chunks to reduce slippage
- **Router Optimization**: Finds the best routes across multiple DEX routers
- **Intermediate Token Support**: Uses whitelisted intermediate tokens for optimal routing
- **React Frontend**: Modern, responsive web interface with wallet integration
- **Documentation Site**: Comprehensive VitePress-powered documentation
- **Harmony Network**: Optimized for Harmony blockchain with WONE support

## 📁 Project Structure

### Smart Contracts (`contracts/`)
- **AggregatorMultiSplit.sol**: Core contract implementing multi-split functionality with router and intermediate token whitelisting
- **BandOracle/**: Price oracle integration using Band Protocol
- **interfaces/**: Contract interfaces for external integrations
  - **IUniswapV2Router02.sol**: Uniswap V2 router interface
  - **IWETH.sol**: Wrapped ETH interface
- **lib/**: Utility libraries for routing and swap calculations
  - **RouterLib.sol**: Route optimization and slippage calculation functions
- **Mocks/**: Test contracts for development and testing

### Frontend Application (`src/`)
- **components/**: React components including swap interface, admin panels, and notifications
- **pages/**: Application pages (Home, Liquidity, Transactions, Settings, Admin)
- **hooks/**: Custom React hooks for blockchain interactions
- **services/**: API services and blockchain integration
- **web3/**: Web3 configuration and wallet connection (AppKit)
- **context/**: React context providers for state management

### Scripts & Deployment (`scripts/`)
- **deploy.js**: Smart contract deployment script
- **simulate.js**: Swap simulation and testing
- **benchmarkAggregator.mjs**: Performance benchmarking
- **verify.js**: Contract verification on block explorers

### Testing (`test/`)
- **AggregatorMultiSplit.test.js**: Comprehensive contract tests
- **fixtures.js**: Test data and mock setups

### Documentation (`docs/`)
- **VitePress-powered documentation site**
- **Multi-language support** (English, Portuguese)
- **API documentation**, architecture guides, and setup instructions

## 🚀 Installation

Install project dependencies:

```bash
# Install smart contract dependencies
npm install

# Install frontend dependencies (if running separately)
cd src && npm install
```

## 💻 Usage

### Smart Contract Development

Deploy contracts to Harmony network:
```bash
# Deploy to Harmony mainnet
npm run deploy

# Deploy to Harmony testnet  
npm run deploy:testnet
```

Run contract simulations:
```bash
# Simulate on mainnet
npm run simulate

# Simulate on testnet
npm run simulate:testnet
```

Run tests:
```bash
npm run test
```

### Frontend Development

The frontend is configured to run with Vite and includes:

```bash
# Start development server (configured in vite.config.js)
npm run dev  # Runs on port 3007 by default

# Build for production
npm run build

# Preview production build
npm run preview
```

### Documentation

Generate and serve documentation:
```bash
cd docs
npm run dev     # Development server
npm run build   # Build static site
npm run preview # Preview built site
```

## 🔧 Configuration

### Environment Variables
- `WONE_ADDRESS`: Wrapped ONE token address
- `ROUTERS`: Comma-separated list of DEX router addresses
- `INTERMEDIATES`: Comma-separated list of intermediate token addresses
- `FEE_BPS`: Fee in basis points (e.g., 25 = 0.25%)
- `VITE_PORT`: Frontend development port
- `VITE_API_GATEWAY_URL`: API gateway URL for backend services

### Network Configuration
The project is configured for Harmony network in `hardhat.config.js` with support for:
- Harmony mainnet (chainId: 1666600000)
- Harmony testnet
- Custom block explorer integration
- Contract verification setup

## 🏗️ Architecture

RecoveryDex follows a modular architecture:

1. **Smart Contract Layer**: Handles on-chain logic, routing, and swapping
2. **Frontend Layer**: React-based user interface with Web3 integration
3. **Documentation Layer**: VitePress site for comprehensive documentation
4. **Testing Layer**: Comprehensive test suite for contracts and frontend

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests for improvements and bug fixes.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.

## 🔗 Links

- **Documentation**: Comprehensive guides and API references in `/docs`
- **Frontend Demo**: React application showcasing the aggregator
- **Smart Contracts**: Deployed on Harmony network with verification