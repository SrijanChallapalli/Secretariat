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
import { ogGalileo, adiTestnet } from "@/lib/chains";

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

const chainNames: Record<number, string> = {
  [ogGalileo.id]: "0G Demo",
  [adiTestnet.id]: "ADI Institutional",
};

export function TerminalLayout({ children }: TerminalLayoutProps) {
  const pathname = usePathname();
  const chainId = useChainId();
  const [showOracleFeed, setShowOracleFeed] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="w-56 border-r border-border flex flex-col shrink-0 bg-sidebar">
        <div className="pt-10 pb-8 px-3">
          <span className="font-serif text-2xl font-extrabold tracking-[-0.01em] text-brand-ivory">
            Secretariat
          </span>
          <div className="text-[6.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground/40 mt-2.5">
            Decentralized Thoroughbred Terminal
          </div>
        </div>
        <nav className="flex-1 py-2 space-y-0.5 px-2">
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
                className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Circle className="h-2 w-2 fill-terminal-green text-terminal-green" />
            <span className="font-mono">RPC Connected</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Circle className="h-2 w-2 fill-terminal-green text-terminal-green" />
            <span className="font-mono">Contracts Ready</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border flex items-center px-4 gap-4 shrink-0 bg-background/95 backdrop-blur">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search horses..."
              className="h-8 pl-8 bg-secondary text-sm font-mono border-border rounded-sm"
            />
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Circle className="h-2 w-2 fill-terminal-green text-terminal-green" />
            <span>
              {chainNames[chainId] ?? (chainId ? `Chain ${chainId}` : "No chain")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowOracleFeed((prev) => !prev)}
            className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-[11px] font-mono transition-colors ${
              showOracleFeed
                ? "border-terminal-green/60 text-terminal-green bg-secondary/60"
                : "border-border text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            <Radio className="h-3 w-3" />
            <span>Oracle feed</span>
          </button>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-secondary text-xs font-mono border border-border">
            <Wallet className="h-3.5 w-3.5" />
            <ConnectButton />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto p-5 scrollbar-terminal">
            {children}
          </main>

          {showOracleFeed && (
            <aside className="w-80 border-l border-border shrink-0 overflow-y-auto scrollbar-terminal hidden xl:block bg-background">
              <LiveFeed />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

