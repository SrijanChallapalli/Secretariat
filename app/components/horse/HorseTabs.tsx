"use client";

import { ReactNode } from "react";

export type HorseTabId = "overview" | "ownership" | "breeding" | "analytics";

interface HorseTabsProps {
  activeTab: HorseTabId;
  onTabChange: (tab: HorseTabId) => void;
  children: ReactNode;
}

export function HorseTabs({ activeTab, onTabChange, children }: HorseTabsProps) {
  return (
    <div>
      <div className="flex gap-2 border-b border-white/10 mb-4">
        {(["overview", "ownership", "breeding", "analytics"] as HorseTabId[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? "border-b-2 border-terminal-cyan text-terminal-cyan"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
