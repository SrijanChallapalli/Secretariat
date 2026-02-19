"use client";

interface DemandBarProps {
  score: number;
  maxScore?: number;
}

export function DemandBar({ score, maxScore = 100 }: DemandBarProps) {
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-prestige-gold transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-foreground w-6 text-right shrink-0">
        {score}
      </span>
    </div>
  );
}
