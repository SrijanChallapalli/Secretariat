"use client";

import { useSearchParams } from "next/navigation";
import {
  useAccount,
  useChainId,
  useWriteContract,
  useSignTypedData,
  useReadContract,
  usePublicClient,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { addresses, abis } from "@/lib/contracts";
import { useState, useMemo, useEffect } from "react";
import {
  scoreStallions,
  fetchServerRecommendations,
  expectedOffspringTraits,
  type HorseTraits,
  type Recommendation,
} from "@/lib/breeding-advisor";
import { validateHorseName } from "../../../shared/name-validator";
import {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
  formatEther,
  decodeEventLog,
  parseAbiItem,
} from "viem";

const MAX_UINT256 = 2n ** 256n - 1n;
import { PedigreeTree } from "@/components/PedigreeTree";
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
import { useHorsesWithListings } from "@/lib/hooks/useHorsesWithListings";
import { SEX_MALE, SEX_FEMALE, sexLabel, closelyRelated } from "@/lib/breeding-rules";
import { getTxExplorerUrl } from "@/lib/block-explorer";
import { toast } from "sonner";

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

const BRED_EVENT = parseAbiItem(
  "event Bred(uint256 indexed stallionId, uint256 indexed mareId, uint256 indexed offspringId)"
);

const MINTED_HORSE_KEY = "secretariat_minted_horse";
const MINT_CORRELATION_KEY = "secretariat_mint_correlation_id";
const DEBUG_MINT_TRACE = typeof window !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_MINT_TRACE === "true";

async function parseOffspringIdFromReceipt(
  client: { getTransactionReceipt: (opts: { hash: `0x${string}` }) => Promise<{ logs: { address?: `0x${string}`; topics: readonly `0x${string}`[]; data: `0x${string}` }[] } | null> },
  hash: `0x${string}`,
  breedingMarketplaceAddress: `0x${string}`,
  maxAttempts = 20
): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    // viem throws TransactionReceiptNotFoundError while the tx is still
    // pending. That must not escape the loop, or a perfectly normal
    // not-yet-mined receipt surfaces as "receipt could not be found" and
    // masks the real on-chain revert reason.
    let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>> | null = null;
    try {
      receipt = await client.getTransactionReceipt({ hash });
    } catch {
      receipt = null;
    }
    if (receipt) {
      if (DEBUG_MINT_TRACE) {
        console.debug("[MintTrace] receipt", { txHash: hash, logCount: receipt.logs.length });
      }
      for (const log of receipt.logs) {
        if (log.address?.toLowerCase() !== breedingMarketplaceAddress.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: [BRED_EVENT],
            data: log.data,
            topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
          });
          if (decoded.eventName === "Bred") {
            const offspringId = Number(decoded.args.offspringId);
            if (DEBUG_MINT_TRACE) {
              console.debug("[MintTrace] Bred event", { offspringId, stallionId: decoded.args.stallionId, mareId: decoded.args.mareId });
            }
            return offspringId;
          }
        } catch {
          /* not Bred event */
        }
      }
      return null;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function mapRecommendationToDisplay(
  rec: Recommendation,
  stallions: HorseTraits[],
  rank: 1 | 2 | 3,
  mareTraits?: number[],
): BreedingPickDisplay {
  const stallion = stallions.find((s) => s.tokenId === rec.stallionTokenId);
  const name = stallion?.name
    ? String(stallion.name)
    : `Stallion #${rec.stallionTokenId}`;

  const { traitMatch, pedigreeSynergy, inbreedingRisk } = rec.explainability;

  let explanation: string;
  if (rec.aiExplanation) {
    explanation = rec.aiExplanation;
  } else {
    const reasons: string[] = [];
    if (pedigreeSynergy >= 0.7) reasons.push("pedigree synergy");
    if (traitMatch >= 0.6) reasons.push("strong trait match");
    if (inbreedingRisk < 0.1) reasons.push("low inbreeding risk");
    if (reasons.length === 0) reasons.push("viable pairing");
    const whyPrefix = rank === 1 ? "Top pick: " : "";
    explanation =
      rec.riskFlags.length === 0
        ? `${whyPrefix}${reasons.join(" + ")}.`
        : `${whyPrefix}${reasons.join(" + ")}. Consider: ${rec.riskFlags.join(", ")}.`;
  }

  const offspringTraits =
    stallion && mareTraits && stallion.traitVector.length > 0 && mareTraits.length > 0
      ? expectedOffspringTraits(stallion.traitVector, mareTraits)
      : undefined;

  return {
    stallionTokenId: rec.stallionTokenId,
    stallionName: name,
    rank,
    badge: BADGES[rank - 1],
    match: Math.round(rec.score * 100),
    projEdge:
      (rec.explainability.traitMatch + rec.explainability.pedigreeSynergy) *
        50 -
      50,
    soundnessDelta: stallion?.injured ? -2 : 0,
    confidence: Math.round(rec.score * 100),
    explanation,
    offspringTraits,
    predictedOffspringValue: rec.predictedOffspringValue,
  };
}

function toHorseTraits(
  horsesWithListings: import("@/lib/hooks/useHorsesWithListings").HorseWithListing[]
): HorseTraits[] {
  return horsesWithListings.map(({ tokenId, raw, listing }) => ({
    tokenId,
    name: raw.name || `Horse #${tokenId}`,
    traitVector: Array.isArray(raw.traitVector)
      ? raw.traitVector.map(Number)
      : [],
    pedigreeScore: raw.pedigreeScore,
    valuationADI: raw.valuationADI,
    injured: raw.injured,
    breedingAvailable: raw.breedingAvailable,
    sex: raw.sex,
    sireId: Number(raw.sireId),
    damId: Number(raw.damId),
    studFeeADI: listing?.studFeeADI ?? 0n,
  }));
}

function getInitialMareId(
  mareParam: string | null,
  stallionParam: string | null
): string {
  if (mareParam) return mareParam;
  if (stallionParam) return "";
  return "1";
}

export default function BreedPage() {
  const searchParams = useSearchParams();
  const mareParam = searchParams.get("mare");
  const stallionParam = searchParams.get("stallion");
  const advisorActive = searchParams.get("advisor") !== "0";
  const chainId = useChainId();
  const { address } = useAccount();
  const [mareId, setMareId] = useState<string>(() =>
    getInitialMareId(mareParam, stallionParam)
  );
  const [picks, setPicks] = useState<Recommendation[] | null>(null);
  const [picksLoading, setPicksLoading] = useState(false);
  const [selectedStallionId, setSelectedStallionId] = useState<number | null>(null);
  const [directBreedName, setDirectBreedName] = useState("");
  const [timelineStep, setTimelineStep] = useState<TimelineStepId>("approve_adi");

  const horsesWithListings = useHorsesWithListings();
  const horses = useMemo(
    () => toHorseTraits(horsesWithListings),
    [horsesWithListings]
  );

  const mare = horses.find((h) => h.tokenId === Number(mareId));
  // Injured horses cannot breed — the contract reverts with "Not breedable" —
  // so keep them out of the candidate pool entirely.
  const stallions = horses.filter(
    (h) =>
      h.tokenId !== Number(mareId) &&
      (h.studFeeADI ?? 0n) > 0n &&
      !h.injured &&
      h.breedingAvailable !== false &&
      h.sex === SEX_MALE &&
      !closelyRelated(h, horses.find((m) => m.tokenId === Number(mareId)), horses)
  );

  // Sync mareId when URL params change (e.g. navigation from horse card)
  useEffect(() => {
    const next = getInitialMareId(mareParam, stallionParam);
    if (next !== mareId) setMareId(next);
  }, [mareParam, stallionParam]);

  // Auto-fetch picks when mare is pre-selected from URL
  useEffect(() => {
    if (!mare || stallions.length === 0 || picks !== null || picksLoading) return;
    fetchPicks(mare, stallions);
  }, [mare, stallions, picks, picksLoading]);

  // Pre-select stallion when coming from stallion page and it appears in picks
  useEffect(() => {
    if (!stallionParam || !picks || picks.length === 0) return;
    const sid = Number(stallionParam);
    if (Number.isNaN(sid)) return;
    const inPicks = picks.some((p) => p.stallionTokenId === sid);
    if (inPicks) setSelectedStallionId(sid);
  }, [stallionParam, picks]);

  const mares: MareItem[] = useMemo(() => {
    // Only females can be a dam — the contract requires it.
    const females = horses.filter((h) => h.sex === SEX_FEMALE);
    const sorted = [...females].sort((a, b) => b.pedigreeScore - a.pedigreeScore);
    const topIds = new Set(sorted.slice(0, 3).map((h) => h.tokenId));
    return females.map((h) => ({
      id: h.tokenId,
      name: String(h.name || `Horse #${h.tokenId}`),
      pedigree: Math.round(h.pedigreeScore / 100),
      valuation: Number(formatEther(BigInt(h.valuationADI))),
      isTopMare: topIds.has(h.tokenId),
      injured: !!h.injured,
      notBreedable: h.breedingAvailable === false,
    }));
  }, [horses]);

  const breedingPicksDisplay: BreedingPickDisplay[] = useMemo(() => {
    if (!picks || picks.length === 0) return [];
    return picks.slice(0, 3).map((p, idx) =>
      mapRecommendationToDisplay(p, stallions, (idx + 1) as 1 | 2 | 3, mare?.traitVector)
    );
  }, [picks, stallions, mare?.traitVector]);

  async function fetchPicks(m: HorseTraits, s: HorseTraits[]) {
    const maxFee = 1000n * BigInt(1e18);
    setPicksLoading(true);
    try {
      const { recommendations } = await fetchServerRecommendations(m, s, maxFee);
      if (recommendations.length > 0) {
        setPicks(recommendations);
        setTimelineStep("sign_eip712");
        setPicksLoading(false);
        return;
      }
    } catch {
      // server unavailable — fall back to client scoring
    }
    setPicks(scoreStallions(m, s, maxFee));
    setTimelineStep("sign_eip712");
    setPicksLoading(false);
  }

  const getRecommendations = () => {
    if (!mare) return;
    fetchPicks(mare, stallions);
  };

  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const { writeContract: purchaseRight, writeContractAsync: purchaseRightAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync: breedAsync } = useWriteContract();

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

  // ADI allowance for BreedingMarketplace (required for purchaseBreedingRight)
  const { data: adiAllowance, refetch: refetchAllowance } = useReadContract({
    address: addresses.adiToken,
    abi: abis.MockADI,
    functionName: "allowance",
    args: address && addresses.breedingMarketplace !== "0x0000000000000000000000000000000000000000" ? [address, addresses.breedingMarketplace] : undefined,
    query: { enabled: !!address },
  });

  // Stud fee for the stallion we're about to purchase (direct or advisor)
  const activeStallionId = selectedStallionId ?? picks?.[0]?.stallionTokenId ?? null;
  const studFeeADI = activeStallionId != null
    ? (stallions.find((s) => s.tokenId === activeStallionId)?.studFeeADI ?? 0n)
    : 0n;
  const needsApproval = !!address && studFeeADI > 0n && adiAllowance !== undefined && adiAllowance < studFeeADI;

  const { writeContract: approveADI } = useWriteContract();
  const { writeContractAsync: approveOperatorAsync } = useWriteContract();
  const { writeContractAsync: executePlanAsync } = useWriteContract();

  // Has the user granted AgentExecutor operator authority on their horses?
  const { data: agentApproved, refetch: refetchAgentApproval } = useReadContract({
    address: addresses.horseINFT,
    abi: abis.HorseINFT,
    functionName: "isApprovedForAll",
    args: address ? [address, addresses.agentExecutor] : undefined,
    query: { enabled: !!address },
  });

  // Skip approve_adi when allowance is already sufficient
  useEffect(() => {
    if (!needsApproval && timelineStep === "approve_adi" && (picks?.length ?? 0) > 0) {
      setTimelineStep("sign_eip712");
    }
  }, [needsApproval, timelineStep, picks?.length]);

  const handleApproveADI = () => {
    approveADI(
      {
        address: addresses.adiToken,
        abi: abis.MockADI,
        functionName: "approve",
        args: [addresses.breedingMarketplace, MAX_UINT256],
      },
      {
        onSuccess: (hash) => {
          setTimelineStep("sign_eip712");
          refetchAllowance();
          const url = getTxExplorerUrl(chainId, hash);
          toast.success("ADI approved", {
            action: { label: "View on Explorer", onClick: () => window.open(url, "_blank") },
          });
        },
        onError: (err) => {
          const msg = err?.message ?? "Unknown error";
          toast.error(msg.includes("allowance") ? "Insufficient allowance or approval failed" : "Failed to approve ADI");
        },
      }
    );
  };

  const handlePurchaseRight = (stallionId: number) => {
    if (needsApproval) {
      toast.error("Approve ADI first, then purchase.");
      return;
    }
    // Don't let the user pay a stud fee toward a pairing that cannot execute.
    const stallion = horses.find((h) => h.tokenId === stallionId);
    if (stallion?.injured) {
      toast.error(`${stallion.name} is recovering from injury and cannot breed right now.`);
      return;
    }
    if (mare?.injured) {
      toast.error(`${mare.name} is recovering from injury and cannot breed right now.`);
      return;
    }
    if (mare && mare.breedingAvailable === false) {
      toast.error(`${mare.name} is not registered for breeding (newborns are not eligible).`);
      return;
    }
    const seed = keccak256(
      toHex(new TextEncoder().encode(`${address}-${stallionId}-${Date.now()}`))
    );
    purchaseRight(
      {
        address: addresses.breedingMarketplace,
        abi: abis.BreedingMarketplace,
        functionName: "purchaseBreedingRight",
        args: [BigInt(stallionId), seed],
      },
      {
        onSuccess: (hash) => {
          setTimelineStep("breed");
          queryClient.invalidateQueries();
          const url = getTxExplorerUrl(chainId, hash);
          toast.success("Breeding right purchased", {
            action: { label: "View on Explorer", onClick: () => window.open(url, "_blank") },
          });
        },
        onError: (err) => {
          const msg = String(err?.message ?? "");
          toast.error(
            msg.includes("KYC") ? "KYC required. Run seed script to verify your address." :
            msg.includes("allowance") ? "Approve ADI first, then purchase." :
            "Failed to purchase breeding right"
          );
        },
      }
    );
  };

  const handleExecute = async (stallionId: number, name: string) => {
    if (!address || !mare || !publicClient) return;
    if (needsApproval) {
      toast.error("Approve ADI first, then execute.");
      return;
    }
    // Pre-flight the contract's "Not breedable" require so the user never
    // signs, pays, or waits on a transaction that is guaranteed to revert.
    if (mare.injured) {
      toast.error(`${mare.name} is recovering from injury and cannot breed right now.`);
      return;
    }
    if (mare.breedingAvailable === false) {
      toast.error(`${mare.name} is not registered for breeding (newborns are not eligible).`);
      return;
    }
    const chosen = horses.find((h) => h.tokenId === stallionId);
    if (chosen && chosen.sex !== SEX_MALE) {
      toast.error(`${chosen.name} is a ${sexLabel(chosen.sex).toLowerCase()} and cannot sire a foal.`);
      return;
    }
    if (mare.sex !== SEX_FEMALE) {
      toast.error(`${mare.name} is a ${sexLabel(mare.sex).toLowerCase()} and cannot carry a foal.`);
      return;
    }
    if (closelyRelated(chosen, mare, horses)) {
      toast.error(`${chosen?.name} and ${mare.name} are too closely related to breed.`);
      return;
    }
    const chosenStallion = horses.find((h) => h.tokenId === stallionId);
    if (chosenStallion?.injured) {
      toast.error(`${chosenStallion.name} is recovering from injury and cannot breed right now.`);
      return;
    }

    // Step 1: EIP-712 signature (compliance record, kept for UX ceremony)
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
    // Must match AgentExecutor's EIP712("SecretariatBreeding", "1") exactly.
    // OpenZeppelin's _hashTypedDataV4 binds the domain to the verifying
    // contract, so omitting verifyingContract produces a signature that fails
    // ECDSA.recover on-chain.
    const domain = {
      name: "SecretariatBreeding",
      version: "1",
      chainId,
      verifyingContract: addresses.agentExecutor,
    } as const;

    try {
      const signature = await signTypedDataAsync({
        domain,
        types: BREEDING_PLAN_TYPE,
        primaryType: "BreedingPlan",
        message: plan,
      });
      setTimelineStep("purchase_right");

      // Step 2: Grant AgentExecutor operator authority once. This is what lets
      // it act for the user without becoming the economic principal — the stud
      // fee still comes from the user and the foal is minted to the user.
      if (agentApproved !== true) {
        toast.info("Authorizing the agent to execute your signed plan...");
        const approvalHash = await approveOperatorAsync({
          address: addresses.horseINFT,
          abi: abis.HorseINFT,
          functionName: "setApprovalForAll",
          args: [addresses.agentExecutor, true],
        });
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
        await refetchAgentApproval();
      }

      // Step 3: Submit the signed plan to AgentExecutor, which re-verifies the
      // signature, deadline and stud-fee-vs-budget on-chain before it acts.
      setTimelineStep("breed");
      toast.info("Executing signed plan on-chain...");
      const seed = keccak256(
        toHex(new TextEncoder().encode(`${address}-${stallionId}-${Date.now()}`))
      );
      const salt = keccak256(
        toHex(new TextEncoder().encode(`${address}-${Date.now()}`))
      );
      const breedHash = await executePlanAsync({
        address: addresses.agentExecutor,
        abi: abis.AgentExecutor,
        functionName: "execute",
        args: [plan, name || "Offspring", salt, seed, signature],
      });

      // Step 4: Parse offspring and notify
      setTimelineStep("offspring_minted");
      const correlationId = DEBUG_MINT_TRACE ? crypto.randomUUID() : undefined;
      if (correlationId) {
        sessionStorage.setItem(MINT_CORRELATION_KEY, correlationId);
        console.debug("[MintTrace] breed execute", { correlationId, wallet: address, chainId, stallionId, mareId: mare.tokenId, txHash: breedHash });
      }
      const offspringId = await parseOffspringIdFromReceipt(publicClient, breedHash, addresses.breedingMarketplace, 30);
      if (offspringId != null) {
        sessionStorage.setItem(MINTED_HORSE_KEY, String(offspringId));
      }
      queryClient.invalidateQueries();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("secretariat-horse-minted", { detail: { offspringId } }));
      }
      toast.success("Offspring minted!", {
        description: "Find your new horse in Portfolio → My Horses",
        action: {
          label: "View Portfolio",
          onClick: () => { window.location.href = offspringId != null ? `/portfolio?minted=${offspringId}` : "/portfolio"; },
        },
      });
    } catch (err: unknown) {
      const msg = String((err as Error)?.message ?? "");
      if (msg.includes("User rejected") || msg.includes("denied")) {
        toast.error("Transaction cancelled.");
      } else {
        toast.error(
          msg.includes("KYC") ? "KYC required. Run seed script to verify your address." :
          msg.includes("allowance") ? "Approve ADI first, then execute." :
          msg.includes("Not mare owner") ? "You must own the mare to breed." :
          msg.includes("Not breedable") ? "One of the horses is injured or not registered for breeding." :
          msg.includes("Sire must be male") ? "The chosen stallion is not male." :
          msg.includes("Dam must be female") ? "The chosen mare is not female." :
          msg.includes("Too closely related") ? "These horses are too closely related (parent or grandparent)." :
          msg.includes("Siblings cannot breed") ? "These horses are siblings and cannot breed." :
          msg.includes("itself") ? "A horse cannot breed with itself." :
          msg.includes("No breeding right") ? "No valid breeding right for this stallion. Purchase one first." :
          `Breeding failed: ${msg.slice(0, 120)}`
        );
      }
    }
  };

  const handleDirectBreed = async () => {
    if (!address || !mare || selectedStallionId === null || !publicClient) return;
    if (!directBreedName || !validateHorseName(directBreedName).valid) return;
    // Pre-flight the contract's "Not breedable" require.
    if (mare.injured) {
      toast.error(`${mare.name} is recovering from injury and cannot breed right now.`);
      return;
    }
    if (mare.breedingAvailable === false) {
      toast.error(`${mare.name} is not registered for breeding (newborns are not eligible).`);
      return;
    }
    const directChosen = horses.find((h) => h.tokenId === selectedStallionId);
    if (directChosen && directChosen.sex !== SEX_MALE) {
      toast.error(`${directChosen.name} is a ${sexLabel(directChosen.sex).toLowerCase()} and cannot sire a foal.`);
      return;
    }
    if (mare.sex !== SEX_FEMALE) {
      toast.error(`${mare.name} is a ${sexLabel(mare.sex).toLowerCase()} and cannot carry a foal.`);
      return;
    }
    if (closelyRelated(directChosen, mare, horses)) {
      toast.error(`${directChosen?.name} and ${mare.name} are too closely related to breed.`);
      return;
    }
    const directStallion = horses.find((h) => h.tokenId === selectedStallionId);
    if (directStallion?.injured) {
      toast.error(`${directStallion.name} is recovering from injury and cannot breed right now.`);
      return;
    }

    const salt = keccak256(
      toHex(new TextEncoder().encode(`${address}-${Date.now()}`))
    );
    try {
      const hash = await breedAsync({
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
      const correlationId = DEBUG_MINT_TRACE ? crypto.randomUUID() : undefined;
      if (correlationId) {
        sessionStorage.setItem(MINT_CORRELATION_KEY, correlationId);
        console.debug("[MintTrace] breed direct", { correlationId, wallet: address, chainId, stallionId: selectedStallionId, mareId: mare.tokenId, txHash: hash });
      }
      const offspringId = await parseOffspringIdFromReceipt(publicClient, hash, addresses.breedingMarketplace, 30);
      if (offspringId != null) {
        sessionStorage.setItem(MINTED_HORSE_KEY, String(offspringId));
      }
      queryClient.invalidateQueries();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("secretariat-horse-minted", { detail: { offspringId } }));
      }
      toast.success("Offspring minted", {
        description: "Find your new horse in Portfolio → My Horses",
        action: {
          label: "View Portfolio",
          onClick: () => { window.location.href = offspringId != null ? `/portfolio?minted=${offspringId}` : "/portfolio"; },
        },
      });
    } catch (err: unknown) {
      const msg = String((err as Error)?.message ?? "");
      if (msg.includes("User rejected") || msg.includes("denied")) {
        toast.error("Transaction cancelled.");
      } else {
        toast.error(
          msg.includes("Not breedable") ? "One of the horses is injured or not registered for breeding." :
          msg.includes("Sire must be male") ? "The chosen stallion is not male." :
          msg.includes("Dam must be female") ? "The chosen mare is not female." :
          msg.includes("Too closely related") ? "These horses are too closely related (parent or grandparent)." :
          msg.includes("Siblings cannot breed") ? "These horses are siblings and cannot breed." :
          msg.includes("itself") ? "A horse cannot breed with itself." :
          msg.includes("right") ? "Purchase breeding right first." :
          "Failed to breed"
        );
      }
    }
  };

  const handleReviewAndApprove = (stallionId: number) => {
    setSelectedStallionId(stallionId);
    setTimelineStep("purchase_right");
  };

  const nameValidation = directBreedName
    ? validateHorseName(directBreedName)
    : null;

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
                  autoComplete="off"
                  className="w-24 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  value={mareId}
                  onChange={(e) => {
                    setMareId(e.target.value);
                    setPicks(null);
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              {needsApproval && (
                <div className="rounded-md border border-prestige-gold/40 bg-prestige-gold/5 p-4 space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Approve ADI (required for stud fee)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Allow the marketplace to spend {formatEther(BigInt(studFeeADI))} ADI for the breeding right.
                  </p>
                  <button
                    onClick={handleApproveADI}
                    className="px-4 py-2 rounded-md bg-prestige-gold text-prestige-gold-foreground text-xs font-medium hover:bg-prestige-gold/90 transition-colors"
                  >
                    Approve ADI
                  </button>
                </div>
              )}
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
                        onClick={() => handlePurchaseRight(selectedStallionId)}
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
                        className={`w-full px-3 py-2 rounded-md bg-input text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background border ${
                          nameValidation && !nameValidation.valid
                            ? "border-destructive/60"
                            : "border-border"
                        }`}
                        value={directBreedName}
                        onChange={(e) => setDirectBreedName(e.target.value)}
                      />
                      {nameValidation && !nameValidation.valid && (
                        <p className="text-[10px] text-destructive">
                          {nameValidation.errors.join("; ")}
                        </p>
                      )}
                      {nameValidation?.valid && (
                        <p className="text-[10px] text-terminal-green">
                          Name valid (Jockey Club rules)
                        </p>
                      )}
                      <button
                        onClick={handleDirectBreed}
                        disabled={
                          !directBreedName || !nameValidation?.valid
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

          {mare && (
            <section className="rounded-md border border-border bg-card p-4">
              <PedigreeTree
                tokenId={mare.tokenId}
                horseName={mare.name}
                maxDepth={3}
              />
            </section>
          )}

          <ExecutionTimeline currentStepId={timelineStep} />
        </>
      )}
    </div>
  );
}
