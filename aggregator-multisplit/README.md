# Aggregator MultiSplit

Este projeto implementa um contrato inteligente para realizar swaps de tokens na rede Ethereum, permitindo a divisão de uma quantidade de entrada (`amountIn`) em múltiplas operações menores. Isso é feito utilizando rotas com tokens intermediários como Jewel, SONIC ou VIPER, com o objetivo de reduzir o slippage em grandes transações.

## Estrutura do Projeto

- **contracts/**: Contém os contratos inteligentes.
  - **AggregatorMultiSplit.sol**: Implementa a funcionalidade de dividir a `amountIn` em múltiplas operações menores, com whitelist de routers e tokens intermediários.
  - **interfaces/**: Define as interfaces para interações com contratos externos.
    - **IUniswapV2Router02.sol**: Interface para o router Uniswap V2.
    - **IWETH.sol**: Interface para o contrato WETH.
  - **lib/**: Contém funções utilitárias para manipulação de rotas e cálculos relacionados a swaps.
    - **RouterLib.sol**: Funções para encontrar a melhor rota e calcular slippage.

- **scripts/**: Scripts para implantar e simular o comportamento dos contratos.
  - **deploy.js**: Script para implantar o AggregatorMultiSplit na rede.

- **test/**: Contém os testes unitários para os contratos.
  - **AggregatorV2.spec.ts**: Testes para o contrato AggregatorV2.
  - **AggregatorV2MultiSplit.spec.ts**: Testes para as novas funcionalidades do contrato AggregatorV2MultiSplit.

- **hardhat.config.js**: Configuração do Hardhat, especificando redes, compiladores e plugins utilizados.

- **package.json**: Configuração do npm, listando as dependências e scripts do projeto.

- **tsconfig.json**: Configuração do TypeScript, especificando opções do compilador e arquivos a serem incluídos na compilação.

## Instalação

Para instalar as dependências do projeto, execute:

```
npm install
```

## Uso

Para implantar os contratos na rede, utilize o script de implantação:

```
npx hardhat deploy:multisplit --network <network_name>
```

Para simular a execução de swaps com a nova funcionalidade de divisão de operações, execute:

```
# exemplo (se houver script de simulação)
# npx hardhat run scripts/simulate-split.ts --network <network_name>
```

## Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests para melhorias e correções.

## Licença

Este projeto está licenciado sob a MIT License. Veja o arquivo LICENSE para mais detalhes.