"use client";

import {
  Settings,
  FileText,
  List,
  AlertCircle,
  Shield,
} from "lucide-react";

interface ModelCardProps {
  whatItDoes: string;
  inputs: string;
  outputs: string;
  limitations: string;
  guardrails: string;
}

const sectionConfig = [
  {
    key: "whatItDoes",
    heading: "What it does",
    icon: Settings,
  },
  {
    key: "inputs",
    heading: "Inputs",
    icon: FileText,
  },
  {
    key: "outputs",
    heading: "Outputs",
    icon: List,
  },
  {
    key: "limitations",
    heading: "Limitations",
    icon: AlertCircle,
  },
  {
    key: "guardrails",
    heading: "Safety & Guardrails",
    icon: Shield,
  },
] as const;

export function ModelCard({
  whatItDoes,
  inputs,
  outputs,
  limitations,
  guardrails,
}: ModelCardProps) {
  const content: Record<string, string> = {
    whatItDoes,
    inputs,
    outputs,
    limitations,
    guardrails,
  };

  return (
    <div className="rounded-sm border border-white/10 bg-black/20 backdrop-blur-sm p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <p className="text-[10px] font-sans tracking-[0.25em] text-prestige-gold-muted uppercase mb-6">
        Model Card
      </p>
      <div className="space-y-6">
        {sectionConfig.map(({ key, heading, icon: Icon }, idx) => (
          <div
            key={key}
            className={idx > 0 ? "pt-6 border-t border-white/5" : undefined}
          >
            <div className="flex items-start gap-3">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1.5">
                  {heading}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {content[key]}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
