// src/utils/loadTokens.js
import tokenList from "../lists/harmony-tokenlist.json"; // Certifique-se de que o caminho esteja correto

export const getTokensByChainId = (chainId) => {
  // Inicializa a variável tokens
  let tokens = [];

  // Verifica se o chainId do tokenList bate com o chainId passado (convertendo ambos para Number)
  if (Number(tokenList.chainId) === Number(chainId)) {
    tokens = tokenList.tokens;
  } else {
    console.warn("Nenhuma lista de tokens para o chainId:", chainId);
  }

  // Define o token nativo Harmony ONE (exibido na UI como "ONE")
  const nativeToken = {
    name: "Harmony ONE",
    chainId: Number(chainId) || 1666600000,
    symbol: "ONE",
    address: "native",
    decimals: 18,
    logoURI: "https://raw.githubusercontent.com/sushiswap/list/master/logos/token-logos/token/one.jpg",
    isNative: true,
  };

  // Retorna a lista com o token nativo adicionado no início
  // Filtra duplicatas caso a lista já possua um token "ONE" com endereço especial
  const hasNative = tokens.some(t => (t.symbol?.toUpperCase?.() === 'ONE') || t.isNative);
  return hasNative ? tokens : [nativeToken, ...tokens];
};

