"use client";

import { BiometricScanSection } from "./BiometricScanSection";
import { PedigreeTree } from "@/components/PedigreeTree";

interface HorseFullData {
  id: number;
  name: string;
  foaled: string;
  sire: string;
  dam: string;
  majorResult: string;
  stewardNote: string;
  dnaHash: string;
  metadataPointer: string;
  lastResult: string;
  oracleSource: string;
  valuation?: number;
  oracleEvents?: any[];
}

interface OverviewTabProps {
  horse: HorseFullData;
}

export function OverviewTab({ horse }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Biometric Scan Section - First block */}
      <BiometricScanSection tokenId={horse.id} />

      {/* Valuation Over Time */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
          VALUATION OVER TIME
        </h3>
        <div className="text-sm text-muted-foreground text-center py-8">
          Chart placeholder - valuation history visualization
        </div>
      </div>

      {/* Oracle Events */}
      {horse.oracleEvents && horse.oracleEvents.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
            ORACLE EVENTS
          </h3>
          <div className="space-y-2">
            {horse.oracleEvents.map((event: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-2 rounded-sm hover:bg-white/5"
              >
                <div className="flex-1">
                  <p className="text-sm">{event.description || event.type}</p>
                  {event.timestamp && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(event.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pedigree Tree */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
          PEDIGREE
        </h3>
        <PedigreeTree tokenId={horse.id} horseName={horse.name} />
      </div>
    </div>
  );
}
