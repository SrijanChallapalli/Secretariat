"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContract } from "wagmi";
import { AgentHeader } from "@/components/agent/AgentHeader";
import { ModelBundleCard } from "@/components/agent/ModelBundleCard";
import { ModelCard } from "@/components/agent/ModelCard";
import { breedingAdvisorModel, type AgentModelInfo } from "@/data/mockAgent";
import { addresses, abis } from "@/lib/contracts";
import { toast } from "sonner";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";
const AGENT_TOKEN_ID = 0n;

export default function AgentPage() {
  const [model, setModel] = useState<AgentModelInfo>(breedingAdvisorModel);
  const [refreshing, setRefreshing] = useState(false);

  const isAgentDeployed =
    addresses.agentINFT !== "0x0000000000000000000000000000000000000000";

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
