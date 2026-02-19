"use client";

import { useState } from "react";
import { formatEther } from "viem";

export function AdiDisplay({ value, showSuffix = false }: { value: bigint; showSuffix?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const num = Number(formatEther(value));

    return (
        <span
            onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
            }}
            className="cursor-pointer hover:text-prestige-gold transition-colors border-b border-dotted border-white/20 hover:border-prestige-gold/50 inline-flex items-center gap-1"
            title="Click to toggle full precision"
        >
            {expanded
                ? num.toLocaleString("en-US", { maximumFractionDigits: 18 })
                : num.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })}
            {showSuffix && <span className="text-xs text-muted-foreground no-underline border-none">ADI</span>}
        </span>
    );
}
