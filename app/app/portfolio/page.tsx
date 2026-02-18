"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { formatEther } from "viem";
import Link from "next/link";

const vaultAbi = [
  "function claimableFor(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
] as const;

export default function PortfolioPage() {
  const { address } = useAccount();

  const { data: balances } = useReadContract({
    address: addresses.adiToken,
    abi: abis.MockADI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const horseCalls = address
    ? [0, 1, 2, 3, 4, 5].map((i) => ({
        address: addresses.horseINFT,
        abi: abis.HorseINFT,
        functionName: "ownerOf" as const,
        args: [BigInt(i)] as [bigint],
      }))
    : [];
  const { data: horseOwnership } = useReadContracts({
    contracts: horseCalls as any,
  });

  const myHorses =
    horseOwnership
      ?.map((c, i) =>
        c.status === "success" && c.result === address ? i : -1,
      )
      .filter((i) => i >= 0) ?? [];

  // For each owned horse, try to resolve a vault and its claimable revenue
  const vaultForHorseCalls =
    address && myHorses.length > 0
      ? myHorses.map((id) => ({
          address: addresses.syndicateVaultFactory,
          abi: abis.HorseSyndicateVaultFactory,
          functionName: "vaultForHorse" as const,
          args: [BigInt(id)] as [bigint],
        }))
      : [];

  const { data: vaultAddresses } = useReadContracts({
    contracts: vaultForHorseCalls as any,
  });

  const vaults =
    (vaultAddresses
      ?.map((c, i) => {
        if (!c || c.status !== "success") return null;
        const addr = c.result as string;
        if (!addr || addr === "0x0000000000000000000000000000000000000000") {
          return null;
        }
        return { horseId: myHorses[i], address: addr as `0x${string}` };
      })
      .filter(Boolean) as { horseId: number; address: `0x${string}` }[]) ?? [];

  const claimableCalls =
    address && vaults.length > 0
      ? vaults.flatMap((v) => [
          {
            address: v.address,
            abi: vaultAbi,
            functionName: "claimableFor" as const,
            args: [address],
          },
          {
            address: v.address,
            abi: vaultAbi,
            functionName: "balanceOf" as const,
            args: [address],
          },
        ])
      : [];

  const { data: vaultPositions } = useReadContracts({
    contracts: claimableCalls as any,
  });

  const revenueRows =
    vaults.length && vaultPositions?.length === vaults.length * 2
      ? vaults.map((v, idx) => {
          const claimableRes = vaultPositions[idx * 2];
          const balanceRes = vaultPositions[idx * 2 + 1];
          const claimable =
            claimableRes?.status === "success"
              ? (claimableRes.result as bigint)
              : 0n;
          const balance =
            balanceRes?.status === "success"
              ? (balanceRes.result as bigint)
              : 0n;
          return {
            horseId: v.horseId,
            claimable,
            balance,
          };
        })
      : [];

  const totalClaimable = revenueRows.reduce(
    (acc, r) => acc + r.claimable,
    0n,
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide text-foreground">
          Portfolio
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview of your ADI balance, vaults, and horse holdings.
        </p>
      </header>
      {!address ? (
        <p className="text-sm text-muted-foreground">
          Connect your wallet to see your portfolio.
        </p>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-sm border border-border bg-card px-4 py-3 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
                ADI balance
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-mono text-prestige-gold">
                  {balances != null ? formatEther(balances as bigint) : "—"} ADI
                </span>
              </div>
            </div>
            <div className="rounded-sm border border-border bg-card px-4 py-3 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
                Horses owned
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-semibold text-foreground">
                  {myHorses.length}
                </span>
              </div>
            </div>
            <div className="rounded-sm border border-border bg-card px-4 py-3 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
                Claimable revenue
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-mono text-prestige-gold">
                  {revenueRows.length > 0
                    ? `${formatEther(totalClaimable)} ADI`
                    : "—"}
                </span>
              </div>
            </div>
            <div className="rounded-sm border border-border bg-card px-4 py-3 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
                Active rights
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-semibold text-foreground">—</span>
              </div>
            </div>
          </section>

          <section className="rounded-sm border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground tracking-wide">
                Holdings
              </h2>
              <span className="text-[11px] font-mono text-muted-foreground">
                Horses and vaults are managed per asset.
              </span>
            </div>
            {myHorses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You own no horses. Buy from the{" "}
                <Link
                  href="/marketplace"
                  className="text-prestige-gold hover:underline"
                >
                  market
                </Link>{" "}
                or use the{" "}
                <Link href="/breed" className="text-prestige-gold hover:underline">
                  breeding lab
                </Link>{" "}
                to mint offspring.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-mono text-muted-foreground">
                      <th className="py-2 text-left">Asset</th>
                      <th className="py-2 text-left">Token ID</th>
                      <th className="py-2 text-left">Links</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myHorses.map((id) => (
                      <tr
                        key={id}
                        className="border-b border-border/60 last:border-b-0"
                      >
                        <td className="py-2">
                          <Link
                            href={`/horse/${id}`}
                            className="text-foreground hover:underline"
                          >
                            Horse #{id}
                          </Link>
                        </td>
                        <td className="py-2 text-muted-foreground font-mono">
                          #{id}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Link
                              href={`/horse/${id}`}
                              className="px-2 py-1 rounded-sm border border-border text-muted-foreground hover:bg-secondary/60"
                            >
                              View detail
                            </Link>
                            <Link
                              href={`/vault/${id}`}
                              className="px-2 py-1 rounded-sm border border-border text-prestige-gold hover:bg-secondary/60"
                            >
                              Vault / claims
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {revenueRows.length > 0 && (
            <section className="rounded-sm border border-border bg-card p-4 space-y-3">
              <h2 className="text-xs font-semibold text-foreground tracking-wide">
                Revenue breakdown
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Claimable ADI from vaults by underlying horse. Values are pulled
                live from each vault&apos;s{" "}
                <span className="font-mono">claimableFor(address)</span>.
              </p>
              <div className="space-y-2">
                {revenueRows.map((row) => {
                  const fraction =
                    totalClaimable > 0n
                      ? Number(row.claimable) / Number(totalClaimable)
                      : 0;
                  return (
                    <div
                      key={row.horseId}
                      className="flex items-center gap-3 text-xs"
                    >
                      <div className="w-40 flex-shrink-0">
                        <Link
                          href={`/vault/${row.horseId}`}
                          className="text-prestige-gold hover:underline"
                        >
                          Horse #{row.horseId}
                        </Link>
                      </div>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-prestige-gold"
                          style={{ width: `${Math.max(fraction * 100, 4)}%` }}
                        />
                      </div>
                      <div className="w-28 text-right font-mono text-prestige-gold">
                        {formatEther(row.claimable)} ADI
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-sm border border-border bg-card p-4 space-y-2">
            <h2 className="text-xs font-semibold text-foreground tracking-wide">
              Agents and advisors
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Use the breeding agents to optimize new offspring, then fractionalize
              via vaults to turn race and breeding revenue into portfolio flows.
            </p>
            <Link
              href="/agent"
              className="inline-flex mt-2 px-3 py-1.5 rounded-sm bg-primary text-primary-foreground text-xs font-mono hover:bg-primary/90 transition-colors"
            >
              Open agents console
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
