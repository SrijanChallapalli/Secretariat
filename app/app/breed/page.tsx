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
import { useState, useMemo } from "react";
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
import { PedigreeTree } from "@/components/PedigreeTree";
import { useReadContract } from "wagmi";
import { MAX_HORSE_ID_TO_FETCH, isOnChainHorse } from "@/lib/on-chain-horses";
import { StudBookHeader } from "@/components/breeding/StudBookHeader";
import {
  MareSelectList,
  type MareItem,
} from "@/components/breeding/MareSelectList";
import {
  BreedingPicks,
  type BreedingPickDisplay,
} from "@/components/breeding/BreedingPicks";
import {
  ExecutionTimeline,
  type TimelineStepId,
} from "@/components/breeding/ExecutionTimeline";

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

const BADGES: ("RECOMMENDED" | "STRONG" | "VIABLE")[] = [
  "RECOMMENDED",
  "STRONG",
  "VIABLE",
];

function mapRecommendationToDisplay(
  rec: Recommendation,
  stallions: HorseTraits[],
  rank: 1 | 2 | 3
): BreedingPickDisplay {
  const stallion = stallions.find((s) => s.tokenId === rec.stallionTokenId);
  const name = stallion?.name
    ? String(stallion.name)
    : `Stallion #${rec.stallionTokenId}`;

  const match = Math.round(rec.score * 100);
  const projEdge =
    (rec.explainability.traitMatch + rec.explainability.pedigreeSynergy) * 50 -
    50;
  const soundnessDelta = stallion?.injured ? -2 : 0;
  const confidence = Math.round(rec.score * 100);

  const explanationParts: string[] = [];
  if (rec.riskFlags.length === 0) {
    explanationParts.push(
      "Strong pedigree cross with complementary traits. Low-risk pairing."
    );
  } else {
    explanationParts.push(
      rec.riskFlags.length > 0
        ? `Consider: ${rec.riskFlags.join(", ")}.`
        : ""
    );
  }
  const explanation =
    explanationParts.join(" ").trim() ||
    "Compatibility based on trait match and pedigree synergy.";

  return {
    stallionTokenId: rec.stallionTokenId,
    stallionName: name,
    rank,
    badge: BADGES[rank - 1],
    match,
    projEdge,
    soundnessDelta,
    confidence,
    explanation,
  };
}

export default function BreedPage() {
  const searchParams = useSearchParams();
  const stallionParam = searchParams.get("stallion");
  const advisorActive = searchParams.get("advisor") === "1";
  const chainId = useChainId();
  const { address } = useAccount();
  const [mareId, setMareId] = useState<string>(stallionParam ? "" : "1");
  const [offspringName, setOffspringName] = useState("");
  const [picks, setPicks] = useState<Recommendation[] | null>(null);
  const [selectedStallionId, setSelectedStallionId] = useState<number | null>(
    null
  );
  const [directBreedName, setDirectBreedName] = useState("");
  const [timelineStep, setTimelineStep] = useState<TimelineStepId>("approve_adi");

  const horseIds = Array.from({ length: MAX_HORSE_ID_TO_FETCH }, (_, i) => i);
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
  const { data: listingsData } = useReadContracts({
    contracts: listingCalls as any,
  });

  const horses: HorseTraits[] = (horsesData ?? [])
    .map((c, i) => {
      if (c.status !== "success" || !c.result || !isOnChainHorse(c.result))
        return null;
      const r = c.result as any;
      if (!r[4]) return null;
      const list = listingsData?.[i];
      const studFee =
        list && list.status === "success" ? (list.result as any)[0] : 0n;
      return {
        tokenId: i,
        name: r[0],
        traitVector: (r[4] as number[]).map(Number),
        pedigreeScore: Number(r[5]),
        valuationADI: r[6],
        injured: r[8],
        studFeeADI: studFee,
      };
    })
    .filter(Boolean) as HorseTraits[];

  const mare = horses.find((h) => h.tokenId === Number(mareId));
  const stallions = horses.filter(
    (h) => h.tokenId !== Number(mareId) && (h as any).studFeeADI > 0n
  );

  const mares: MareItem[] = useMemo(() => {
    const sorted = [...horses].sort(
      (a, b) => b.pedigreeScore - a.pedigreeScore
    );
    const topIds = new Set(sorted.slice(0, 3).map((h) => h.tokenId));
    return horses.map((h) => ({
      id: h.tokenId,
      name: String(h.name || `Horse #${h.tokenId}`),
      pedigree: Math.round(h.pedigreeScore / 100),
      valuation: Number(h.valuationADI) / 1e18,
      isTopMare: topIds.has(h.tokenId),
    }));
  }, [horses]);

  const breedingPicksDisplay: BreedingPickDisplay[] = useMemo(() => {
    if (!picks || picks.length === 0) return [];
    return picks.map((p, idx) =>
      mapRecommendationToDisplay(p, stallions, (idx + 1) as 1 | 2 | 3)
    );
  }, [picks, stallions]);

  const getRecommendations = () => {
    if (!mare) return;
    const maxFee = 1000n * BigInt(1e18);
    const recs = scoreStallions(mare, stallions, maxFee);
    setPicks(recs);
    setTimelineStep("sign_eip712");
  };

  const { writeContract: purchaseRight } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContract: executePlan } = useWriteContract();
  const { writeContract: breedDirect } = useWriteContract();

  const { data: hasBreedingRight } = useReadContract({
    address: addresses.breedingMarketplace,
    abi: abis.BreedingMarketplace,
    functionName: "hasBreedingRight",
    args:
      selectedStallionId !== null && address
        ? [BigInt(selectedStallionId), address]
        : undefined,
    query: { enabled: selectedStallionId !== null && !!address },
  });

  const handlePurchaseRight = async (stallionId: number) => {
    const seed = keccak256(
      toHex(new TextEncoder().encode(`${address}-${stallionId}-${Date.now()}`))
    );
    await purchaseRight({
      address: addresses.breedingMarketplace,
      abi: abis.BreedingMarketplace,
      functionName: "purchaseBreedingRight",
      args: [BigInt(stallionId), seed],
    });
    setTimelineStep("breed");
  };

  const handleExecute = async (stallionId: number, name: string) => {
    if (!address || !mare) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const traitFloor = keccak256(
      encodeAbiParameters(parseAbiParameters("uint8[8]"), [
        [0, 0, 0, 0, 0, 0, 0, 0],
      ])
    );
    const plan = {
      user: address,
      budgetADI: BigInt(1000e18),
      allowlistedStallionsRoot:
        "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      maxStudFeeADI: BigInt(500e18),
      mareTokenId: BigInt(mare.tokenId),
      chosenStallionTokenId: BigInt(stallionId),
      deadline,
      expectedOffspringTraitFloor: traitFloor,
    };
    const domain = {
      name: "SecretariatBreeding",
      version: "1",
      chainId,
    } as const;
    const sig = await signTypedDataAsync({
      domain,
      types: BREEDING_PLAN_TYPE,
      primaryType: "BreedingPlan",
      message: plan,
    });
    const salt = keccak256(
      toHex(new TextEncoder().encode(`${address}-${Date.now()}`))
    );
    const purchaseSeed = keccak256(
      toHex(
        new TextEncoder().encode(`${address}-${stallionId}-${Date.now()}`)
      )
    );
    await executePlan({
      address: addresses.agentExecutor,
      abi: abis.AgentExecutor,
      functionName: "execute",
      args: [
        plan,
        name || "Offspring",
        salt,
        purchaseSeed,
        sig as `0x${string}`,
      ],
    });
    setTimelineStep("offspring_minted");
  };

  const handleDirectBreed = async () => {
    if (!address || !mare || selectedStallionId === null) return;
    if (!directBreedName || !validateHorseName(directBreedName).valid) return;

    const salt = keccak256(
      toHex(new TextEncoder().encode(`${address}-${Date.now()}`))
    );
    await breedDirect({
      address: addresses.breedingMarketplace,
      abi: abis.BreedingMarketplace,
      functionName: "breed",
      args: [
        BigInt(selectedStallionId),
        BigInt(mare.tokenId),
        directBreedName,
        salt,
      ],
    });
    setTimelineStep("offspring_minted");
  };

  const handleReviewAndApprove = (stallionId: number) => {
    setSelectedStallionId(stallionId);
    setTimelineStep("purchase_right");
  };

  return (
    <div className="space-y-6">
      <StudBookHeader advisorActive={advisorActive} />

      {!address ? (
        <p className="text-sm text-muted-foreground">
          Connect your wallet to access breeding tools.
        </p>
      ) : (
        <>
          <section className="grid gap-6 lg:grid-cols-[35%_1fr] items-start">
            <div className="space-y-4">
              <MareSelectList
                mares={mares}
                selectedId={mareId !== "" ? Number(mareId) : null}
                onSelect={(id) => {
                  setMareId(String(id));
                  setPicks(null);
                }}
                emptyMessage="No on-chain horses found. Deploy contracts and run seed script to mint horses."
              />

              <div className="rounded-md border border-border bg-card p-3 space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  Mare token ID (override)
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-24 px-3 py-2 rounded-md bg-secondary border border-border text-sm"
                  value={mareId}
                  onChange={(e) => {
                    setMareId(e.target.value);
                    setPicks(null);
                  }}
                />
              </div>

              {mare && (
                <div className="rounded-md border border-border bg-card p-4">
                  <PedigreeTree tokenId={mare.tokenId} maxDepth={4} />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <BreedingPicks
                picks={breedingPicksDisplay}
                onExecuteWithApproval={advisorActive ? handleExecute : undefined}
                onReviewAndApprove={
                  advisorActive ? handleReviewAndApprove : undefined
                }
                onGetPicks={getRecommendations}
                hasMareSelected={!!mare}
                hasStallions={stallions.length > 0}
              />

              {selectedStallionId !== null && mare && (
                <div className="rounded-md border border-border bg-card p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-foreground tracking-wide">
                    Direct Breeding
                  </h3>
                  <div className="flex items-center gap-2">
                    {hasBreedingRight ? (
                      <span className="text-[10px] text-terminal-green font-mono">
                        ✓ Breeding right active
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          handlePurchaseRight(selectedStallionId)
                        }
                        className="px-3 py-1.5 rounded-md bg-secondary text-xs font-mono hover:bg-secondary/80 transition-colors"
                      >
                        Purchase breeding right
                      </button>
                    )}
                  </div>
                  {hasBreedingRight && (
                    <div className="space-y-2">
                      <input
                        placeholder="Offspring name"
                        className={`w-full px-3 py-2 rounded-md bg-secondary text-sm border ${
                          directBreedName &&
                          !validateHorseName(directBreedName).valid
                            ? "border-destructive/60"
                            : "border-border"
                        }`}
                        value={directBreedName}
                        onChange={(e) => setDirectBreedName(e.target.value)}
                      />
                      {directBreedName &&
                        !validateHorseName(directBreedName).valid && (
                          <p className="text-[10px] text-destructive">
                            {validateHorseName(directBreedName).errors.join(
                              "; "
                            )}
                          </p>
                        )}
                      {directBreedName &&
                        validateHorseName(directBreedName).valid && (
                          <p className="text-[10px] text-terminal-green">
                            Name valid (Jockey Club rules)
                          </p>
                        )}
                      <button
                        onClick={handleDirectBreed}
                        disabled={
                          !directBreedName ||
                          !validateHorseName(directBreedName).valid
                        }
                        className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Breed & Mint Offspring
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <ExecutionTimeline currentStepId={timelineStep} />
        </>
      )}
    </div>
  );
}
