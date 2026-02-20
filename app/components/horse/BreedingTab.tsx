"use client";

interface BreedingTabProps {
  horse: any;
}

export function BreedingTab({ horse }: BreedingTabProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-5">
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
        BREEDING
      </h3>
      <div className="text-sm text-muted-foreground">Breeding information</div>
    </div>
  );
}
