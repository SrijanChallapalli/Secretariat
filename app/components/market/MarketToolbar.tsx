"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface MarketToolbarProps {
  count: number;
  search: string;
  onSearchChange: (value: string) => void;
}

export function MarketToolbar({
  count,
  search,
  onSearchChange,
}: MarketToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <span className="text-[10px] font-sans tracking-[0.2em] text-muted-foreground uppercase">
        {count} HORSES LISTED
      </span>
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-10 bg-white/5 border-white/10 text-sm font-sans text-brand-ivory placeholder:text-muted-foreground/40 rounded-md focus:bg-white/10 focus:border-white/20 transition-all"
        />
      </div>
    </div>
  );
}
