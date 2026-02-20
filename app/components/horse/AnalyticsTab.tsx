"use client";

interface AnalyticsTabProps {
  horse: any;
}

export function AnalyticsTab({ horse }: AnalyticsTabProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-5">
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
        ANALYTICS
      </h3>
      <div className="text-sm text-muted-foreground">Analytics information</div>
    </div>
  );
}
