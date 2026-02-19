"use client";

import { Bot, RefreshCw, Download } from "lucide-react";

interface AgentHeaderProps {
  name: string;
  version: string;
  subtitle: string;
  onRefresh?: () => void;
  onDownload?: () => void;
}

export function AgentHeader({
  name,
  version,
  subtitle,
  onRefresh,
  onDownload,
}: AgentHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div className="flex items-start gap-3">
        <Bot className="h-8 w-8 text-prestige-gold shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-wide text-foreground">
            {name}
          </h1>
          <p className="text-xs font-sans tracking-[0.2em] text-muted-foreground uppercase">
            {version} · {subtitle}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onRefresh ?? (() => console.log("refresh"))}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-border bg-card/80 text-sm text-foreground hover:bg-white/5 hover:border-white/10 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
        <button
          type="button"
          onClick={onDownload ?? (() => console.log("download"))}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-border bg-card/80 text-sm text-foreground hover:bg-white/5 hover:border-white/10 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Download</span>
        </button>
      </div>
    </header>
  );
}
