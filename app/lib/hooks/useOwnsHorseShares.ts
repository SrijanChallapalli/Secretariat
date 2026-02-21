"use client";

import { useAccount, useReadContract } from "wagmi";
import { addresses, abis } from "@/lib/contracts";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/**
 * Returns true when the connected wallet holds any shares of the given horse,
 * either via a syndicate vault or by being the direct on-chain owner.
 */
export function useOwnsHorseShares(
  horseId: number,
  directOwner?: string | null,
): boolean {
  const { address } = useAccount();

  const { data: vaultAddress } = useReadContract({
    address: addresses.syndicateVaultFactory,
    abi: abis.HorseSyndicateVaultFactory,
    functionName: "vaultForHorse",
    args: [BigInt(horseId)],
  });

  const hasVault = !!vaultAddress && vaultAddress !== ZERO;
  const vaultAddr = hasVault ? (vaultAddress as `0x${string}`) : undefined;

  const { data: balance } = useReadContract({
    address: vaultAddr!,
    abi: abis.HorseSyndicateVault,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: hasVault && !!address },
  });

  if (!address) return false;

  if (hasVault) {
    return balance !== undefined && (balance as bigint) > 0n;
  }

  return (
    !!directOwner &&
    directOwner.toLowerCase() === address.toLowerCase()
  );
}
