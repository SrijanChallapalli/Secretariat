import { defineChain } from "viem";

/** Local Anvil chain — use for testing without testnet credentials */
export const anvilLocal = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export const ogGalileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "0G", url: "https://testnet.0g.ai" } },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

export const adiTestnet = defineChain({
  id: 99999,
  name: "ADI AB Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.ab.testnet.adifoundation.ai/"] } },
  blockExplorers: { default: { name: "ADI", url: "https://ab.testnet.adifoundation.ai" } },
});

export const chains = [anvilLocal, ogGalileo, adiTestnet] as const;
