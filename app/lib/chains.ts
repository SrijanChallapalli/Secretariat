import { defineChain } from "viem";

export const ogGalileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "0G", url: "https://testnet.0g.ai" } },
});

export const adiTestnet = defineChain({
  id: 99999,
  name: "ADI AB Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.ab.testnet.adifoundation.ai/"] } },
  blockExplorers: { default: { name: "ADI", url: "https://ab.testnet.adifoundation.ai" } },
});

export const chains = [ogGalileo, adiTestnet] as const;
