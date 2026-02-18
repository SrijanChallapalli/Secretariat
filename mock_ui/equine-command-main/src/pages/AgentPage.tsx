import { Bot, Download, RefreshCw, Shield, Cpu, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const AgentPage = () => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium tracking-wide flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" /> Breeding Advisor iNFT
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            v2.1.0 · Specialization: Thoroughbred Breeding Optimization
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" className="font-mono text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh from 0G
          </Button>
          <Button size="sm" variant="secondary" className="font-mono text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download Bundle
          </Button>
        </div>
      </div>

      {/* Model Bundle */}
      <div className="bg-card border border-border rounded-sm p-4">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Model Bundle
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Bundle Size", value: "142 MB" },
            { label: "Files", value: "12" },
            { label: "rootHash", value: "0xabc...def123" },
            { label: "Last Updated", value: "2026-02-15" },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                {item.label}
              </div>
              <div className="text-sm font-mono">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Card */}
      <div className="bg-card border border-border rounded-sm p-4 space-y-4">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Model Card
        </h3>
        {[
          {
            title: "What it does",
            icon: Cpu,
            content:
              "Analyzes mare-stallion compatibility using trait vectors, pedigree depth, and historical offspring performance data to recommend optimal breeding pairs.",
          },
          {
            title: "Inputs",
            icon: FileText,
            content:
              "Mare trait vector, stallion trait vector, pedigree data, historical race performance, breeding history, market conditions.",
          },
          {
            title: "Outputs",
            icon: FileText,
            content:
              "Top 3 stallion recommendations with compatibility score, projected offspring value uplift, risk delta, and confidence interval.",
          },
          {
            title: "Limitations",
            icon: Shield,
            content:
              "Model trained on historical data only. Does not account for real-time environmental factors. Confidence degrades for horses with < 5 recorded races.",
          },
          {
            title: "Safety & Guardrails",
            icon: Shield,
            content:
              "Maximum 3 recommendations per query. Budget constraints enforced. Trait floor validation. Mandatory EIP-712 signing for execution.",
          },
        ].map((section) => (
          <div key={section.title}>
            <div className="flex items-center gap-2 mb-1">
              <section.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{section.title}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-6">
              {section.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentPage;
