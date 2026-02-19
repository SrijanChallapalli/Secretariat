"use client";

import {
  ArrowRight,
  Check,
  Shield,
  Sparkles,
  Dna,
  Crown,
} from "lucide-react";

export type TimelineStepStatus = "completed" | "current" | "upcoming";

export type TimelineStepId =
  | "approve_adi"
  | "sign_eip712"
  | "purchase_right"
  | "breed"
  | "offspring_minted";

const STEPS: {
  id: TimelineStepId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "approve_adi", label: "Approve ADI", icon: Check },
  { id: "sign_eip712", label: "Sign EIP-712 Plan", icon: Shield },
  { id: "purchase_right", label: "Purchase Right", icon: Sparkles },
  { id: "breed", label: "Breed", icon: Dna },
  { id: "offspring_minted", label: "Offspring Minted", icon: Crown },
];

interface ExecutionTimelineProps {
  currentStepId: TimelineStepId;
  getStepStatus?: (stepId: TimelineStepId) => TimelineStepStatus;
}

function getDefaultStatus(
  stepId: TimelineStepId,
  currentStepId: TimelineStepId
): TimelineStepStatus {
  const idx = STEPS.findIndex((s) => s.id === stepId);
  const currentIdx = STEPS.findIndex((s) => s.id === currentStepId);
  if (idx < currentIdx) return "completed";
  if (idx === currentIdx) return "current";
  return "upcoming";
}

export function ExecutionTimeline({
  currentStepId,
  getStepStatus,
}: ExecutionTimelineProps) {
  const resolveStatus = getStepStatus ?? ((id) => getDefaultStatus(id, currentStepId));

  return (
    <section className="rounded-md border border-border bg-card/40 py-4 px-5">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRight className="h-4 w-4 text-prestige-gold shrink-0" />
        <h2 className="text-xs font-semibold tracking-wider text-prestige-gold uppercase">
          EXECUTION TIMELINE
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        {STEPS.map((step, idx) => {
          const status = resolveStatus(step.id);
          const Icon = step.icon;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.id} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    status === "completed"
                      ? "border-terminal-green bg-terminal-green/20 text-terminal-green"
                      : status === "current"
                        ? "border-prestige-gold bg-prestige-gold/10 text-prestige-gold"
                        : "border-border bg-card/60 text-muted-foreground"
                  }`}
                >
                  {status === "completed" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-xs ${
                    status === "current"
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
