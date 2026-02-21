"use client";

import { useTheme } from "@/components/ThemeProvider";
import { Palette } from "lucide-react";

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() =>
        setTheme(theme === "racing-luxury" ? "terminal" : "racing-luxury")
      }
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-prestige-gold/40 bg-prestige-gold/10 text-xs font-medium text-prestige-gold tracking-wide hover:bg-prestige-gold/20 transition-colors"
      title={
        theme === "racing-luxury"
          ? "Switch to High-contrast terminal"
          : "Switch to Racing luxury"
      }
    >
      <Palette className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">
        {theme === "racing-luxury" ? "Racing" : "Terminal"}
      </span>
    </button>
  );
}
