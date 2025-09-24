// src/store/tokens.js 
import { getTokensByChainId } from "../utils/loadTokens";
import { tokensLoaded, tokensLoadError } from "./reducers/tokens.reducer";

// Thunk para carregar a lista de tokens
export const loadTokensAction = (provider) => async (dispatch) => {
  try {
    const network = await provider.getNetwork();
    // Converte para número para assegurar a igualdade
    const chainId = Number(network.chainId);
    const tokens = getTokensByChainId(chainId);
    console.log("Token list carregada para chainId", chainId, ":", tokens);
    dispatch(tokensLoaded(tokens));
  } catch (error) {
    console.error("Erro ao carregar tokens:", error);
    dispatch(tokensLoadError(error));
  }
};
