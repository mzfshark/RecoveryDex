// src/hooks/useBalances.js
import { useEffect, useState } from "react";
import { fetchTokenBalance } from "../utils/fetchTokenBalance";

export const useBalances = (provider, account, tokenList) => {
  const [tokenBalances, setTokenBalances] = useState({});

  useEffect(() => {
    if (provider && account && tokenList.length > 0) {
      const fetchBalances = async () => {
        const balances = {};
        await Promise.all(
          tokenList.map(async (token) => {
            const bal = await fetchTokenBalance(token, provider, account);
            balances[token.address] = bal;
          })
        );
        setTokenBalances(balances);
      };
      fetchBalances();
    }
  }, [provider, account, tokenList]);

  return tokenBalances;
};