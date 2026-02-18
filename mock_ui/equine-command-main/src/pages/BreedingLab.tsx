import { useState } from "react";
import { horses } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Dna, Bot, ArrowRight, Check, Circle } from "lucide-react";

const BreedingLab = () => {
  const [selectedMare, setSelectedMare] = useState<number | null>(null);
  const mares = horses.filter((_, i) => i % 2 === 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-lg font-medium tracking-wide">Breeding Lab</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Left - Mare Selector */}
        <div>
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Select Mare
          </h2>
          <div className="space-y-2">
            {mares.map((mare) => (
              <button
                key={mare.id}
                onClick={() => setSelectedMare(mare.id)}
                className={`w-full flex items-center justify-between p-3 rounded-sm border transition-colors text-left ${
                  selectedMare === mare.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{mare.name}</div>
                  <div className="text-xs font-mono text-muted-foreground">
                    Pedigree: {mare.pedigreeScore} · ${(mare.valuation / 1000000).toFixed(1)}M
                  </div>
                </div>
                {selectedMare === mare.id && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right - Recommendations */}
        <div>
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-primary" /> Top 3 Breeding Picks
          </h2>
          {selectedMare ? (
            <div className="space-y-3">
              {[
                { stallion: "Golden Sovereign", compatibility: 94, uplift: 12.5, riskDelta: -2, confidence: 92 },
                { stallion: "Royal Fortune", compatibility: 88, uplift: 8.2, riskDelta: 1, confidence: 87 },
                { stallion: "Thunder Reign", compatibility: 82, uplift: 5.8, riskDelta: -1, confidence: 80 },
              ].map((pick, i) => (
                <div
                  key={i}
                  className={`bg-card border rounded-sm p-3 space-y-2 ${
                    i === 0 ? "border-prestige-gold/30 bg-prestige-gold/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{pick.stallion}</span>
                    <span className={`text-xs font-mono ${i === 0 ? "text-prestige-gold" : "text-primary"}`}>#{i + 1}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground">Match</span>
                      <span className="text-primary block">{pick.compatibility}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Proj. Edge</span>
                      <span className="text-terminal-green block">+{pick.uplift}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Soundness Δ</span>
                      <span
                        className={`block ${
                          pick.riskDelta <= 0
                            ? "text-terminal-green"
                            : "text-terminal-red"
                        }`}
                      >
                        {pick.riskDelta}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Edge Conf.</span>
                      <span className="block">{pick.confidence}%</span>
                    </div>
                  </div>
                  <Button size="sm" variant="institutional" className="w-full text-xs">
                    Execute With Approval
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-sm p-8 text-center">
              <Dna className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Select a mare to generate recommendations
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Execution Timeline */}
      {selectedMare && (
        <div className="bg-card border border-border rounded-sm p-4">
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
            Execution Timeline
          </h3>
          <div className="flex items-center gap-3">
            {[
              { label: "Approve ADI", status: "pending" },
              { label: "Purchase Right", status: "pending" },
              { label: "Breed", status: "pending" },
              { label: "Offspring Minted", status: "pending" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">
                    {step.label}
                  </span>
                </div>
                {i < 3 && <ArrowRight className="h-3 w-3 text-border" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BreedingLab;
