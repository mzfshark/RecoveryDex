// src/hooks/useAggregatorContract.js
import { useMemo } from "react";
import { Contract } from "ethers";
import { useContract } from "../context/ContractContext";
import AggregatorArtifact from "../abis/AggregatorMultiSplit.json";

const AGG_ADDRESS =
  import.meta.env.VITE_AGGREGATOR_ADDRESS ||
  "0xc5D2136eF39a570Dcb9DF6b22c730072E9ee8fdA";

export default function useAggregatorContract() {
  const { signer } = useContract();

  return useMemo(() => {
    if (!signer) return null;
    return new Contract(AGG_ADDRESS, AggregatorArtifact.abi, signer);
  }, [signer]);
}
