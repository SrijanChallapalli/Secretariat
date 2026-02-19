"use client";

import { Zap } from "lucide-react";

interface StudBookHeaderProps {
  advisorActive?: boolean;
}

export function StudBookHeader({ advisorActive = true }: StudBookHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-prestige-gold shrink-0" />
          <h1 className="text-2xl font-bold tracking-wide text-foreground">
            Stud Book
          </h1>
        </div>
        <p className="text-xs font-sans tracking-[0.2em] text-muted-foreground uppercase pl-8">
          AI-DRIVEN PAIRING INTELLIGENCE
        </p>
      </div>
      {advisorActive && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card/80 border border-border shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-terminal-green shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="text-xs font-medium text-foreground">Advisor Active</span>
        </div>
      )}
    </header>
  );
}
