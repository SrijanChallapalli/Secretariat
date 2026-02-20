"use client";

interface OwnershipTabProps {
  horse: any;
}

export function OwnershipTab({ horse }: OwnershipTabProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-5">
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
        OWNERSHIP
      </h3>
      <div className="text-sm text-muted-foreground">Ownership information</div>
    </div>
  );
}
