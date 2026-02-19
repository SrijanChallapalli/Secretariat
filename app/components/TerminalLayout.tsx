"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Dna,
  Bot,
  Radio,
  Settings,
  Search,
  Wallet,
  Circle,
} from "lucide-react";
import { useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Input } from "@/components/ui/input";
import LiveFeed from "@/components/LiveFeed";

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
  const chainId = useChainId();
  const [showOracleFeed, setShowOracleFeed] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-prestige-gold/30">
      <aside className="w-64 border-r border-sidebar-border/60 flex flex-col shrink-0 bg-sidebar-background shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)] z-20">
        <div className="pt-8 pb-6 px-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-1 bg-prestige-gold rounded-full" />
            <span className="font-heading text-2xl font-bold tracking-wide text-brand-ivory">
              SECRETARIAT
            </span>
          </div>
          <div className="pl-3 text-[10px] font-sans tracking-[0.2em] text-prestige-gold-muted uppercase">
            Est. 2024 · RWA
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.path === "/"
                ? pathname === "/"
                : pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`group flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-all duration-300 ${isActive
                  ? "bg-sidebar-accent/50 text-prestige-gold font-medium border border-sidebar-border/50 shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/30 hover:text-brand-ivory hover:pl-5"
                  }`}
              >
                <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-prestige-gold" : "text-sidebar-foreground/60 group-hover:text-prestige-gold-muted"}`} />
                <span className="font-sans tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mx-3 mb-4 rounded-lg bg-sidebar-accent/20 border border-sidebar-border/30 space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 font-sans tracking-wider uppercase">
            <div className={`h-1.5 w-1.5 rounded-full ${chainId ? "bg-terminal-green shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-destructive"}`} />
            <span>System Status</span>
          </div>
          <div className="flex items-center justify-between text-xs text-brand-ivory/80">
            <span>Contracts</span>
            <span className="text-terminal-green">Optimal</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-[url('/noise.png')]">
        <header className="h-16 border-b border-white/5 flex items-center px-6 gap-6 shrink-0 bg-background/80 backdrop-blur-md">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Search bloodlines, horses, owners..."
              className="h-9 pl-10 bg-white/5 border-white/5 text-sm font-sans text-brand-ivory placeholder:text-muted-foreground/40 rounded-full focus:bg-white/10 focus:border-white/10 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowOracleFeed((prev) => !prev)}
            className={`hidden lg:inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-300 ${showOracleFeed
              ? "border-prestige-gold/30 text-prestige-gold bg-prestige-gold/10"
              : "border-white/10 text-muted-foreground hover:bg-white/5 hover:text-brand-ivory"
              }`}
          >
            <Radio className="h-3.5 w-3.5" />
            <span className="tracking-wide">ORACLE WIRE</span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <ConnectButton
              chainStatus="full"
              showBalance={{ smallScreen: false, largeScreen: true }}
              accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <main className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {children}
          </main>

          {showOracleFeed && (
            <aside className="w-80 border-l border-white/5 shrink-0 overflow-y-auto scrollbar-hide hidden xl:block bg-black/20 backdrop-blur-sm">
              <LiveFeed />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

