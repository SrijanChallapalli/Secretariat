"use client";

import { ReactNode } from "react";

export type HorseTabId = "overview" | "ownership" | "breeding" | "analytics";

const TABS: { id: HorseTabId; label: string }[] = [
  { id: "overview", label: "OVERVIEW" },
  { id: "ownership", label: "OWNERSHIP" },
  { id: "breeding", label: "BREEDING" },
  { id: "analytics", label: "ANALYTICS" },
];

interface HorseTabsProps {
  activeTab: HorseTabId;
  onTabChange: (tab: HorseTabId) => void;
  children: ReactNode;
}

export function HorseTabs({ activeTab, onTabChange, children }: HorseTabsProps) {
  return (
    <div className="space-y-6">
      <div className="flex gap-8 border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`pb-3 text-sm font-medium tracking-wider transition-colors ${
              activeTab === tab.id
                ? "text-prestige-gold border-b-2 border-prestige-gold -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
