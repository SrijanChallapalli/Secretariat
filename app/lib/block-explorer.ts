import { ogGalileo, adiTestnet } from "./chains";

const chainExplorers: Record<number, string> = {
  [ogGalileo.id]: ogGalileo.blockExplorers?.default?.url ?? "https://testnet.0g.ai",
  [adiTestnet.id]: adiTestnet.blockExplorers?.default?.url ?? "https://ab.testnet.adifoundation.ai",
};

/**
 * Returns the block explorer URL for a transaction on the given chain.
 */
export function getTxExplorerUrl(chainId: number, txHash: string): string {
  const base = chainExplorers[chainId];
  if (!base) return "#";
  const normalized = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  return `${base.replace(/\/$/, "")}/tx/${normalized}`;
}
