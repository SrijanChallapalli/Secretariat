"use client";

import { useSearchParams } from "next/navigation";
import {
  useAccount,
  useChainId,
  useReadContracts,
  useWriteContract,
  useSignTypedData,
} from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { useState } from "react";
import {
  scoreStallions,
  type HorseTraits,
  type Recommendation,
} from "@/lib/breeding-advisor";
import { validateHorseName } from "../../../shared/name-validator";
import {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
} from "viem";

const BREEDING_PLAN_TYPE = {
  BreedingPlan: [
    { name: "user", type: "address" },
    { name: "budgetADI", type: "uint256" },
    { name: "allowlistedStallionsRoot", type: "bytes32" },
    { name: "maxStudFeeADI", type: "uint256" },
    { name: "mareTokenId", type: "uint256" },
    { name: "chosenStallionTokenId", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "expectedOffspringTraitFloor", type: "bytes32" },
  ],
} as const;

export default function BreedPage() {
  const searchParams = useSearchParams();
  const stallionParam = searchParams.get("stallion");
  const advisorActive = searchParams.get("advisor") === "1";
  const chainId = useChainId();
  const { address } = useAccount();
  const [mareId, setMareId] = useState(stallionParam ? "" : "1");
  const [offspringName, setOffspringName] = useState("");
  const [executeMode, setExecuteMode] = useState(false);
  const [picks, setPicks] = useState<Recommendation[] | null>(null);

  const horseIds = [0, 1, 2, 3, 4];
  const horseCalls = horseIds.map((id) => ({
    address: addresses.horseINFT,
    abi: abis.HorseINFT,
    functionName: "getHorseData" as const,
    args: [BigInt(id)] as [bigint],
  }));
  const listingCalls = horseIds.map((id) => ({
    address: addresses.breedingMarketplace,
    abi: abis.BreedingMarketplace,
    functionName: "listings" as const,
    args: [BigInt(id)] as [bigint],
  }));
  const { data: horsesData } = useReadContracts({ contracts: horseCalls as any });
  const { data: listingsData } = useReadContracts({ contracts: listingCalls as any });

  const horses: HorseTraits[] = (horsesData ?? []).map((c, i) => {
    if (c.status !== "success" || !c.result) return null;
    const r = c.result as any;
    if (!r[4]) return null;
    const list = listingsData?.[i];
    const studFee = list && list.status === "success" ? (list.result as any)[0] : 0n;
    return {
      tokenId: i,
      name: r[0],
      traitVector: (r[4] as number[]).map(Number),
      pedigreeScore: Number(r[5]),
      valuationADI: r[6],
      injured: r[8],
      studFeeADI: studFee,
    };
  }).filter(Boolean) as HorseTraits[];

  const mare = horses.find((h) => h.tokenId === Number(mareId));
  const stallions = horses.filter((h) => h.tokenId !== Number(mareId) && (h as any).studFeeADI > 0n);

  const getRecommendations = () => {
    if (!mare) return;
    const maxFee = 1000n * BigInt(1e18);
    const recs = scoreStallions(mare, stallions, maxFee);
    setPicks(recs);
  };

  const { writeContract: purchaseRight } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContract: executePlan } = useWriteContract();

  const handlePurchaseRight = async (stallionId: number) => {
    const seed = keccak256(toHex(new TextEncoder().encode(`${address}-${stallionId}-${Date.now()}`)));
    await purchaseRight({
      address: addresses.breedingMarketplace,
      abi: abis.BreedingMarketplace,
      functionName: "purchaseBreedingRight",
      args: [BigInt(stallionId), seed],
    });
  };

  const handleExecute = async (stallionId: number) => {
    if (!address || !mare) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const traitFloor = keccak256(encodeAbiParameters(parseAbiParameters("uint8[8]"), [[0, 0, 0, 0, 0, 0, 0, 0]]));
    const plan = {
      user: address,
      budgetADI: BigInt(1000e18),
      allowlistedStallionsRoot: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      maxStudFeeADI: BigInt(500e18),
      mareTokenId: BigInt(mare.tokenId),
      chosenStallionTokenId: BigInt(stallionId),
      deadline,
      expectedOffspringTraitFloor: traitFloor,
    };
    const domain = { name: "SecretariatBreeding", version: "1", chainId } as const;
    const sig = await signTypedDataAsync({ domain, types: BREEDING_PLAN_TYPE, primaryType: "BreedingPlan", message: plan });
    const salt = keccak256(toHex(new TextEncoder().encode(`${address}-${Date.now()}`)));
    const purchaseSeed = keccak256(toHex(new TextEncoder().encode(`${address}-${stallionId}-${Date.now()}`)));
    await executePlan({
      address: addresses.agentExecutor,
      abi: abis.AgentExecutor,
      functionName: "execute",
      args: [plan, offspringName || "Offspring", salt, purchaseSeed, sig as `0x${string}`],
    });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide text-foreground">
          Breeding Lab
        </h1>
        <p className="text-sm text-muted-foreground">
          Select a mare, get top 3 stallion recommendations, then purchase and
          execute a breeding plan with on-chain agents.
        </p>
      </header>
      {!address ? (
        <p className="text-sm text-muted-foreground">
          Connect your wallet to access breeding tools.
        </p>
      ) : (
        <>
          <section className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,3fr)] items-start">
            <div className="space-y-4">
              <div className="rounded-sm border border-border bg-card p-4 space-y-3">
                <label className="block text-xs font-medium text-muted-foreground">
                  Mare (your horse) token ID
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-24 px-3 py-2 rounded-sm bg-secondary border border-border text-sm"
                  value={mareId}
                  onChange={(e) => setMareId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Or pick from the list below. Only horses with trait vectors
                  are shown.
                </p>
              </div>

              <div className="rounded-sm border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold text-foreground tracking-wide">
                    Select mare
                  </h2>
                  {mare && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Token #{mare.tokenId}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {horses.map((h) => {
                    const selected = h.tokenId === Number(mareId);
                    return (
                      <button
                        key={h.tokenId}
                        type="button"
                        onClick={() => setMareId(String(h.tokenId))}
                        className={`w-full text-left px-3 py-2 rounded-sm border text-sm transition-colors ${
                          selected
                            ? "border-terminal-green/70 bg-secondary/80"
                            : "border-border bg-secondary/40 hover:bg-secondary/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground truncate">
                              {String(h.name)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Pedigree {(h.pedigreeScore / 100).toFixed(1)}% ·{" "}
                              {Number(h.valuationADI) / 1e18} ADI
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {horses.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1 py-2">
                      No demo horses found. Seed horses on-chain to use the
                      breeding lab.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {advisorActive && (
                <section className="rounded-sm border border-border bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xs font-semibold text-foreground tracking-wide">
                        Top 3 breeding picks
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Breeding Advisor scores stallions on compatibility, risk, and uplift — powered by Secretariat&apos;s XGBoost model.
                      </p>
                    </div>
                    <button
                      onClick={getRecommendations}
                      className="px-3 py-1.5 rounded-sm bg-primary text-primary-foreground text-xs font-mono hover:bg-primary/90 transition-colors"
                    >
                      Get top 3 picks
                    </button>
                  </div>

                  {picks ? (
                    <ul className="space-y-3">
                      {picks.map((p, idx) => (
                        <li
                          key={p.stallionTokenId}
                          className="border border-border rounded-sm bg-secondary/40 p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                Stallion #{p.stallionTokenId}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Match {(p.score * 100).toFixed(1)}%
                              </p>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              #{idx + 1}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Risks: {p.riskFlags.join(", ") || "None"}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => handlePurchaseRight(p.stallionTokenId)}
                              className="px-3 py-1 rounded-sm bg-secondary text-xs font-mono hover:bg-secondary/80 transition-colors"
                            >
                              Purchase right
                            </button>
                            {executeMode && (
                              <div className="flex flex-col gap-1">
                                <div className="flex gap-2 items-center">
                                  <input
                                    placeholder="Offspring name"
                                    className={`px-2 py-1 rounded-sm bg-secondary text-xs w-40 border ${
                                      offspringName &&
                                      !validateHorseName(offspringName).valid
                                        ? "border-destructive/60"
                                        : "border-border"
                                    }`}
                                    value={offspringName}
                                    onChange={(e) =>
                                      setOffspringName(e.target.value)
                                    }
                                  />
                                  <button
                                    onClick={() =>
                                      handleExecute(p.stallionTokenId)
                                    }
                                    disabled={
                                      !!offspringName &&
                                      !validateHorseName(offspringName).valid
                                    }
                                    className="px-3 py-1 rounded-sm bg-primary text-primary-foreground text-xs font-mono disabled:opacity-40"
                                  >
                                    Execute plan
                                  </button>
                                </div>
                                {offspringName &&
                                  !validateHorseName(offspringName).valid && (
                                    <p className="text-[10px] text-destructive">
                                      {validateHorseName(offspringName).errors.join(
                                        "; ",
                                      )}
                                    </p>
                                  )}
                                {offspringName &&
                                  validateHorseName(offspringName).valid && (
                                    <p className="text-[10px] text-terminal-green">
                                      Name valid (Jockey Club rules)
                                    </p>
                                  )}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="border border-dashed border-border rounded-sm bg-secondary/30 p-6 text-center">
                      <p className="text-xs text-muted-foreground">
                        Select a mare on the left, then fetch top 3 picks to see
                        match scores and risks.
                      </p>
                    </div>
                  )}
                  <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={executeMode}
                      onChange={(e) => setExecuteMode(e.target.checked)}
                    />
                    Execute with approval (sign plan and execute on-chain)
                  </label>
                </section>
              )}
            </div>
          </section>

          <section className="rounded-sm border border-border bg-card p-4 space-y-2">
            <h2 className="text-xs font-semibold text-foreground tracking-wide">
              Execution timeline
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Advisor mode: recommend-only. Execute mode: sign typed plan and
              let the agent contract purchase rights and call{" "}
              <span className="font-mono">
                breed(stallionId, mareId, offspringName, salt)
              </span>
              .
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground">
              <span className="px-3 py-1 rounded-sm bg-secondary/60 border border-border">
                1. Approve ADI
              </span>
              <span className="px-3 py-1 rounded-sm bg-secondary/60 border border-border">
                2. Purchase breeding right
              </span>
              <span className="px-3 py-1 rounded-sm bg-secondary/60 border border-border">
                3. Sign BreedingPlan
              </span>
              <span className="px-3 py-1 rounded-sm bg-secondary/60 border border-border">
                4. Offspring minted
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
