"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Dna,
  Bot,
  Radio,
  Settings,
  Video,
} from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ogGalileo, adiTestnet } from "@/lib/chains";

import LiveFeed from "@/components/LiveFeed";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { LandingPage } from "@/components/LandingPage";

const RECORD_MODE_KEY = "secretariat-record-mode";

const chainNames: Record<number, string> = {
  [ogGalileo.id]: "0G Demo",
  [adiTestnet.id]: "ADI Institutional",
};

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/marketplace", label: "Market", icon: TrendingUp },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase },
  { path: "/breed", label: "Breeding Lab", icon: Dna },
  { path: "/agent", label: "Agent", icon: Bot },
  { path: "/vault", label: "Vaults", icon: Radio },
  { path: "/admin", label: "Settings", icon: Settings },
];

interface TerminalLayoutProps {
  children: ReactNode;
}

export function TerminalLayout({ children }: TerminalLayoutProps) {
  const pathname = usePathname();
  const { address } = useAccount();
  const chainId = useChainId();
  const [showOracleFeed, setShowOracleFeed] = useState(true);
  const [recordMode, setRecordMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(RECORD_MODE_KEY);
    if (stored === "true") setRecordMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(RECORD_MODE_KEY, String(recordMode));
  }, [recordMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRecordMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!address) {
    return <LandingPage />;
  }

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground selection:bg-prestige-gold/30 flex flex-col">
      {/* Horse gallops across center of screen, title reveals, then terminal fades in */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-30 flex items-center">
        <div className="h-40 w-40 horse-run">
          <Image
            src="/running-horse.gif"
            alt=""
            width={160}
            height={160}
            className="h-full w-full object-contain"
            style={{ filter: "brightness(0) invert(0.6) sepia(1) saturate(3) hue-rotate(4deg) brightness(0.95)" }}
            unoptimized
          />
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center horse-title-fadeout">
        <span className="font-heading text-6xl sm:text-7xl md:text-8xl font-bold tracking-[0.12em] text-brand-ivory glow-gold select-none flex" aria-label="SECRETARIAT">
          {"SECRETARIAT".split("").map((ch, i, arr) => {
            const startFrac = 0.30;
            const endFrac = 0.72;
            const frac = startFrac + (endFrac - startFrac) * (i / (arr.length - 1));
            const delay = Math.pow(frac, 0.59) * 2.5;
            return (
              <span
                key={i}
                className="horse-letter inline-block"
                style={{ animationDelay: `${delay.toFixed(2)}s` }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      </div>

      {/* Top header: oracle wire, wallet, chain — collapsible for recording */}
      <header
        className={`terminal-delayed shrink-0 z-20 flex items-center justify-end gap-3 px-4 py-2 border-b border-white/10 bg-background/95 backdrop-blur-md transition-all duration-300 ${
          recordMode ? "h-0 overflow-hidden border-0 py-0 opacity-0 pointer-events-none" : ""
        }`}
      >
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowOracleFeed((prev) => !prev)}
          className={`hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shrink-0 ${showOracleFeed
            ? "border-prestige-gold/30 text-prestige-gold bg-prestige-gold/10"
            : "border-white/10 text-muted-foreground hover:bg-white/5 hover:text-brand-ivory"
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          <span>ORACLE WIRE</span>
        </button>
        <ThemeSwitch />
        <div className="px-2.5 py-1 rounded-full border border-prestige-gold/40 bg-prestige-gold/10 text-xs font-medium text-prestige-gold shrink-0">
          {chainNames[chainId] ?? `Chain ${chainId}`}
        </div>
        <ConnectButton
          chainStatus="full"
          showBalance={{ smallScreen: false, largeScreen: true }}
          accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
        />
        <button
          type="button"
          onClick={() => setRecordMode((prev) => !prev)}
          title={recordMode ? "Show controls" : "Hide controls for recording"}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
            recordMode
              ? "border-terminal-green/50 text-terminal-green bg-terminal-green/10"
              : "border-white/10 text-muted-foreground hover:bg-white/5 hover:text-brand-ivory"
          }`}
        >
          <Video className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{recordMode ? "Show" : "Record"}</span>
        </button>
      </header>

      {/* Floating Record toggle when header is hidden — lets you show controls again */}
      {recordMode && (
        <button
          type="button"
          onClick={() => setRecordMode(false)}
          className="fixed top-3 right-3 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border border-terminal-green/40 bg-background/95 backdrop-blur-md text-terminal-green hover:bg-terminal-green/10 text-xs font-medium transition-colors shadow-lg"
          title="Show controls"
        >
          <Video className="h-3.5 w-3.5" />
          Show
        </button>
      )}

      {/* Left sidebar + main content */}
      <div className="terminal-delayed flex flex-1 overflow-hidden bg-[url('/noise.png')]">
        <aside className="w-64 border-r border-sidebar-border/60 flex flex-col shrink-0 bg-sidebar-background shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)] z-20">
          <div className="pt-8 pb-6 px-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-1 bg-prestige-gold rounded-full" />
              <span className="font-heading text-2xl font-bold tracking-wide text-brand-ivory">
                SECRETARIAT
              </span>
            </div>
            <div className="pl-3 text-[10px] font-sans tracking-[0.2em] text-prestige-gold-muted uppercase">
              Est. 2026 · RWA
            </div>
          </div>

          <nav className="flex-1 py-4 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-all duration-300 ${
                    isActive
                      ? "bg-sidebar-accent/50 text-prestige-gold font-medium border border-sidebar-border/50 shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/30 hover:text-brand-ivory hover:pl-5"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? "text-prestige-gold" : "text-sidebar-foreground/60 group-hover:text-prestige-gold-muted"
                    }`}
                  />
                  <span className="font-sans tracking-wide">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 mx-3 mb-4 rounded-lg bg-sidebar-accent/20 border border-sidebar-border/30 space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 font-sans tracking-wider uppercase">
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  chainId ? "bg-terminal-green shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-destructive"
                }`}
              />
              <span>System Status</span>
            </div>
            <div className="flex items-center justify-between text-xs text-brand-ivory/80">
              <span>Contracts</span>
              <span className="text-terminal-green">Optimal</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {children}
        </main>
        {showOracleFeed && !recordMode && (
          <aside className="w-80 border-l border-sidebar-border/60 shrink-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hidden xl:block bg-card backdrop-blur-sm">
            <LiveFeed />
          </aside>
        )}
      </div>
    </div>
  );
}

