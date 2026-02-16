"use client";

import { useSearchParams } from "next/navigation";
import { useAccount, useChainId, useReadContracts, useWriteContract, useSignTypedData } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { useState } from "react";
import { scoreStallions, type HorseTraits, type Recommendation } from "@/lib/breeding-advisor";
import { encodeAbiParameters, parseAbiParameters, keccak256, toHex } from "viem";

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
  const advisorMode = searchParams.get("advisor") === "1";
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
    const recs = scoreStallions(mare, stallions, 1000n * BigInt(1e18));
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
    <div>
      <h1 className="text-3xl font-bold text-gold-400 mb-6">Breeding</h1>
      {!address ? (
        <p className="text-stone-500">Connect wallet.</p>
      ) : (
        <>
          <div className="rounded-xl border border-track-600 bg-track-700 p-5 mb-6">
            <label className="block text-stone-300 mb-2">Mare (your horse) token ID</label>
            <input
              type="number"
              min={0}
              className="w-24 px-3 py-2 rounded bg-track-800 border border-track-600"
              value={mareId}
              onChange={(e) => setMareId(e.target.value)}
            />
          </div>
          {advisorMode && (
            <div className="mb-6">
              <button
                onClick={getRecommendations}
                className="px-4 py-2 rounded bg-gold-500 text-track-800 font-medium"
              >
                Get top 3 breeding picks
              </button>
              {picks && (
                <ul className="mt-4 space-y-3">
                  {picks.map((p) => (
                    <li key={p.stallionTokenId} className="border border-track-600 rounded-lg p-4">
                      <p className="font-medium">Stallion #{p.stallionTokenId} · Score: {(p.score * 100).toFixed(1)}%</p>
                      <p className="text-sm text-stone-400">Risks: {p.riskFlags.join(", ") || "None"}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handlePurchaseRight(p.stallionTokenId)}
                          className="px-3 py-1 rounded bg-track-600 text-sm"
                        >
                          Purchase right
                        </button>
                        {executeMode && (
                          <>
                            <input
                              placeholder="Offspring name"
                              className="px-2 py-1 rounded bg-track-800 text-sm w-32"
                              value={offspringName}
                              onChange={(e) => setOffspringName(e.target.value)}
                            />
                            <button
                              onClick={() => handleExecute(p.stallionTokenId)}
                              className="px-3 py-1 rounded bg-gold-500 text-track-800 text-sm"
                            >
                              Execute plan
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={executeMode} onChange={(e) => setExecuteMode(e.target.checked)} />
                Execute with approval (sign plan and execute on-chain)
              </label>
            </div>
          )}
          <p className="text-stone-500 text-sm">Purchase breeding right with ADI, then call breed(stallionId, mareId, offspringName, salt).</p>
        </>
      )}
    </div>
  );
}
