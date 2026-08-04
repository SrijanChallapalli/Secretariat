"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  useReadContract,
  useReadContracts,
  useAccount,
  useChainId,
  useWriteContract,
  useSignTypedData,
  usePublicClient,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { keccak256, toHex } from "viem";
import { AgentHeader } from "@/components/agent/AgentHeader";
import { ModelBundleCard } from "@/components/agent/ModelBundleCard";
import { ModelCard } from "@/components/agent/ModelCard";
import { AgentProposalCard } from "@/components/agent/AgentProposalCard";
import { breedingAdvisorModel, type AgentModelInfo } from "@/data/mockAgent";
import { addresses, abis } from "@/lib/contracts";
import { useHorsesWithListings } from "@/lib/hooks/useHorsesWithListings";
import type { HorseTraits } from "@/lib/breeding-advisor";
import { buildAgentProposal, type AgentProposal, type ProposedPairing } from "@/lib/agent-proposal";
import { getTxExplorerUrl } from "@/lib/block-explorer";
import { toast } from "sonner";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";
const AGENT_TOKEN_ID = 0n;
const MAX_UINT256 = 2n ** 256n - 1n;
const MAX_STUD_FEE = 500n * 10n ** 18n;
const BUDGET = 1000n * 10n ** 18n;

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

export default function AgentPage() {
  const [model, setModel] = useState<AgentModelInfo>(breedingAdvisorModel);
  const [refreshing, setRefreshing] = useState(false);
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [proposing, setProposing] = useState(false);
  const [executing, setExecuting] = useState(false);

  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  const horsesWithListings = useHorsesWithListings();
  const horses: HorseTraits[] = useMemo(
    () =>
      horsesWithListings.map(({ tokenId, raw, listing }) => ({
        tokenId,
        name: raw.name || `Horse #${tokenId}`,
        traitVector: Array.isArray(raw.traitVector) ? raw.traitVector.map(Number) : [],
        pedigreeScore: raw.pedigreeScore,
        valuationADI: raw.valuationADI,
        injured: raw.injured,
        breedingAvailable: raw.breedingAvailable,
        sex: raw.sex,
        sireId: Number(raw.sireId),
        damId: Number(raw.damId),
        studFeeADI: listing?.studFeeADI ?? 0n,
      })),
    [horsesWithListings],
  );

  // Which of these does the connected account own? The agent may only propose
  // mares the user actually controls.
  const { data: ownership } = useReadContracts({
    contracts: horses.map((h) => ({
      address: addresses.horseINFT,
      abi: abis.HorseINFT,
      functionName: "ownerOf" as const,
      args: [BigInt(h.tokenId)] as [bigint],
    })),
    query: { enabled: horses.length > 0 && !!address },
  });

  const ownedTokenIds = useMemo(() => {
    const set = new Set<number>();
    if (!ownership || !address) return set;
    ownership.forEach((r, i) => {
      if (r.status === "success" && String(r.result).toLowerCase() === address.toLowerCase()) {
        set.add(horses[i].tokenId);
      }
    });
    return set;
  }, [ownership, address, horses]);

  const isAgentDeployed =
    addresses.agentINFT !== "0x0000000000000000000000000000000000000000";

  const handlePropose = useCallback(async () => {
    if (!address) {
      toast.error("Connect a wallet first.");
      return;
    }
    setProposing(true);
    try {
      const result = await buildAgentProposal(horses, ownedTokenIds, MAX_STUD_FEE);
      setProposal(result);
      if (result.ranked.length === 0) {
        toast.info("No legal pairing found", {
          description:
            result.maresConsidered === 0
              ? "You own no mare that is registered for breeding and healthy."
              : "Every stallion at stud is either related to your mares or unavailable.",
        });
      } else {
        const top = result.ranked[0];
        toast.success("Proposal ready", {
          description: `${top.stallion.name} × ${top.mare.name} — ${Math.round(top.score * 100)}% match`,
        });
      }
    } catch (err) {
      toast.error(`Could not build a proposal: ${String((err as Error)?.message ?? "").slice(0, 120)}`);
    } finally {
      setProposing(false);
    }
  }, [address, horses, ownedTokenIds]);

  /**
   * Sign the plan and submit it through AgentExecutor, which re-verifies the
   * signature, deadline and stud fee on-chain before acting. The agent never
   * holds funds — it acts for the user via ERC-721 operator approval.
   */
  const handleExecute = useCallback(
    async (pairing: ProposedPairing) => {
      if (!address || !publicClient) return;
      setExecuting(true);
      try {
        const plan = {
          user: address,
          budgetADI: BUDGET,
          allowlistedStallionsRoot: `0x${"00".repeat(32)}` as `0x${string}`,
          maxStudFeeADI: MAX_STUD_FEE,
          mareTokenId: BigInt(pairing.mare.tokenId),
          chosenStallionTokenId: BigInt(pairing.stallion.tokenId),
          deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
          expectedOffspringTraitFloor: `0x${"00".repeat(32)}` as `0x${string}`,
        };

        toast.info("Review the plan in your wallet…");
        const signature = await signTypedDataAsync({
          // Must match AgentExecutor's EIP712("SecretariatBreeding", "1");
          // OpenZeppelin binds the domain to the verifying contract.
          domain: {
            name: "SecretariatBreeding",
            version: "1",
            chainId,
            verifyingContract: addresses.agentExecutor,
          },
          types: BREEDING_PLAN_TYPE,
          primaryType: "BreedingPlan",
          message: plan,
        });

        // The marketplace pulls the stud fee from the user, so the user must
        // have approved it — not the executor.
        const allowance = (await publicClient.readContract({
          address: addresses.adiToken,
          abi: abis.MockADI,
          functionName: "allowance",
          args: [address, addresses.breedingMarketplace],
        })) as bigint;
        if (allowance < pairing.studFeeADI) {
          toast.info("Approving ADI for the marketplace…");
          const h = await writeContractAsync({
            address: addresses.adiToken,
            abi: abis.MockADI,
            functionName: "approve",
            args: [addresses.breedingMarketplace, MAX_UINT256],
          });
          await publicClient.waitForTransactionReceipt({ hash: h });
        }

        // One-time, revocable: lets AgentExecutor act for this account.
        const approved = (await publicClient.readContract({
          address: addresses.horseINFT,
          abi: abis.HorseINFT,
          functionName: "isApprovedForAll",
          args: [address, addresses.agentExecutor],
        })) as boolean;
        if (!approved) {
          toast.info("Authorising the agent to execute your signed plan…");
          const h = await writeContractAsync({
            address: addresses.horseINFT,
            abi: abis.HorseINFT,
            functionName: "setApprovalForAll",
            args: [addresses.agentExecutor, true],
          });
          await publicClient.waitForTransactionReceipt({ hash: h });
        }

        toast.info("Executing the signed plan on-chain…");
        const txHash = await writeContractAsync({
          address: addresses.agentExecutor,
          abi: abis.AgentExecutor,
          functionName: "execute",
          args: [
            plan,
            `${pairing.mare.name ?? "Foal"} Colt`.slice(0, 18),
            keccak256(toHex(`${address}-${Date.now()}`)),
            keccak256(toHex(`${address}-seed-${Date.now()}`)),
            signature,
          ],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status === "reverted") throw new Error("Transaction reverted on-chain");

        queryClient.invalidateQueries();
        const url = getTxExplorerUrl(chainId, txHash);
        toast.success("Foal minted from the agent's plan", {
          description: "Find it in Portfolio → My Horses",
          action: { label: "View transaction", onClick: () => window.open(url, "_blank") },
        });
        setProposal(null);
      } catch (err) {
        const msg = String((err as Error)?.message ?? "");
        if (msg.includes("User rejected") || msg.includes("denied")) {
          toast.error("Cancelled.");
        } else {
          toast.error(
            msg.includes("Not authorized for account")
              ? "The agent is not authorised to act for you. Approve it and retry."
              : msg.includes("Over budget")
                ? "The stud fee exceeds the budget you signed."
                : msg.includes("Too closely related")
                  ? "These horses are too closely related to breed."
                  : msg.includes("Siblings")
                    ? "These horses are siblings and cannot breed."
                    : msg.includes("Expired")
                      ? "The signed plan expired. Propose again."
                      : `Execution failed: ${msg.slice(0, 120)}`,
          );
        }
      } finally {
        setExecuting(false);
      }
    },
    [address, publicClient, chainId, signTypedDataAsync, writeContractAsync, queryClient],
  );

  const { data: profileData, refetch: refetchProfile } = useReadContract({
    address: addresses.agentINFT,
    abi: abis.BreedingAdvisorINFT,
    functionName: "profiles",
    args: [AGENT_TOKEN_ID],
    query: { enabled: isAgentDeployed },
  });

  useEffect(() => {
    if (!profileData) return;
    const [name, version, specialization, modelBundleRootHash] =
      profileData as [string, string, string, string];

    if (name) {
      setModel((prev) => ({
        ...prev,
        name: name || prev.name,
        version: version || prev.version,
        subtitle: specialization?.toUpperCase() || prev.subtitle,
        rootHash: modelBundleRootHash || prev.rootHash,
      }));
    }
  }, [profileData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchProfile();

      if (model.rootHash && model.rootHash !== breedingAdvisorModel.rootHash) {
        try {
          const res = await fetch(
            `${SERVER_URL}/og/download/${model.rootHash}`,
            { method: "HEAD" },
          );
          if (res.ok) {
            const size = res.headers.get("content-length");
            if (size) {
              setModel((prev) => ({
                ...prev,
                bundleSizeMb: Math.round(Number(size) / (1024 * 1024)),
                lastUpdated: new Date().toISOString().slice(0, 10),
              }));
            }
          }
        } catch {
          // server unavailable — keep existing bundle metadata
        }
      }

      toast.success("Agent metadata refreshed from chain");
    } catch {
      toast.error("Failed to refresh agent metadata");
    } finally {
      setRefreshing(false);
    }
  }, [model.rootHash, refetchProfile]);

  const handleDownload = useCallback(() => {
    if (
      model.rootHash &&
      model.rootHash !== breedingAdvisorModel.rootHash
    ) {
      window.open(
        `${SERVER_URL}/og/download/${model.rootHash}`,
        "_blank",
      );
      return;
    }
    const blob = new Blob([JSON.stringify(model, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breeding-advisor-${model.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [model]);

  return (
    <div className="space-y-6 max-w-4xl">
      <AgentHeader
        name={model.name}
        version={`v${model.version}`}
        subtitle={model.subtitle}
        onRefresh={handleRefresh}
        onDownload={handleDownload}
      />

      {refreshing && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Fetching on-chain metadata and 0G Storage bundle...
        </p>
      )}

      {!isAgentDeployed && (
        <div className="rounded-sm border border-yellow-500/30 bg-yellow-500/5 p-3">
          <p className="text-xs text-yellow-200">
            Agent iNFT contract not deployed. Showing static metadata.
            Deploy contracts and run seed:demo to mint the Breeding Advisor iNFT.
          </p>
        </div>
      )}

      <AgentProposalCard
        proposal={proposal}
        loading={proposing}
        executing={executing}
        onPropose={handlePropose}
        onExecute={handleExecute}
        connected={!!address}
      />
      <ModelBundleCard
        bundleSizeMb={model.bundleSizeMb}
        filesCount={model.filesCount}
        rootHash={model.rootHash}
        lastUpdated={model.lastUpdated}
      />
      <ModelCard
        whatItDoes={model.whatItDoes}
        inputs={model.inputs}
        outputs={model.outputs}
        limitations={model.limitations}
        guardrails={model.guardrails}
      />
    </div>
  );
}
