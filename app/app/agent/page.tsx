"use client";

import { AgentHeader } from "@/components/agent/AgentHeader";
import { ModelBundleCard } from "@/components/agent/ModelBundleCard";
import { ModelCard } from "@/components/agent/ModelCard";
import { breedingAdvisorModel } from "@/data/mockAgent";

export default function AgentPage() {
  const model = breedingAdvisorModel;

  const handleRefresh = () => {
    // TODO: Refetch agent metadata when API/contract integration exists
  };

  const handleDownload = () => {
    // Placeholder: export AgentModelInfo as JSON
    const blob = new Blob([JSON.stringify(model, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breeding-advisor-${model.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <AgentHeader
        name={model.name}
        version={`v${model.version}`}
        subtitle={model.subtitle}
        onRefresh={handleRefresh}
        onDownload={handleDownload}
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
