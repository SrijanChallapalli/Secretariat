import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, Briefcase, Dna, Bot,
  Radio, Settings, Search, Wallet, Circle, ChevronDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import LiveFeed from "./LiveFeed";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/market", label: "Market", icon: TrendingUp },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase },
  { path: "/breeding-lab", label: "Breeding Lab", icon: Dna },
  { path: "/agent", label: "Agent", icon: Bot },
  { path: "/oracle", label: "Oracle Feed", icon: Radio },
  { path: "/settings", label: "Settings", icon: Settings },
];

interface TerminalLayoutProps {
  children: ReactNode;
}

const TerminalLayout = ({ children }: TerminalLayoutProps) => {
  const location = useLocation();
  const [network, setNetwork] = useState<"0g" | "adi">("0g");

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Left Sidebar */}
      <aside className="w-56 border-r border-border flex flex-col shrink-0 bg-sidebar">
        {/* Brand Masthead — structurally separate from nav */}
        <div className="pt-10 pb-8 px-3">
          <span className="font-serif text-2xl font-extrabold tracking-[-0.01em] text-brand-ivory">Secretariat</span>
          <div className="text-[6.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground/40 mt-2.5">
            Decentralized Thoroughbred Terminal
          </div>
        </div>
        <nav className="flex-1 py-2 space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Circle className="h-2 w-2 fill-terminal-green text-terminal-green" />
            <span className="font-mono">RPC Connected</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Circle className="h-2 w-2 fill-terminal-green text-terminal-green" />
            <span className="font-mono">Contracts Ready</span>
          </div>
        </div>
      </aside>

      {/* Main + Right */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 border-b border-border flex items-center px-4 gap-4 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search horses..."
              className="h-8 pl-8 bg-secondary border-border text-sm font-mono"
            />
          </div>

          <button
            onClick={() => setNetwork((n) => (n === "0g" ? "adi" : "0g"))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-secondary text-xs font-mono hover:bg-muted transition-colors"
          >
            <Circle
              className={`h-2 w-2 ${
                network === "0g"
                  ? "fill-terminal-green text-terminal-green"
                  : "fill-terminal-cyan text-terminal-cyan"
              }`}
            />
            {network === "0g" ? "0G Demo" : "ADI Institutional"}
            <ChevronDown className="h-3 w-3" />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-secondary text-xs font-mono">
            <Wallet className="h-3.5 w-3.5" />
            0x1a2...3b4
          </div>

          <div className="text-xs font-mono text-muted-foreground">
            <span className="text-foreground font-semibold">12,450</span>{" "}
            ADI
          </div>
        </header>

        {/* Content + Right panel */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto p-5 scrollbar-terminal">
            {children}
          </main>

          {/* Right Live Feed */}
          <aside className="w-80 border-l border-border shrink-0 overflow-y-auto scrollbar-terminal hidden xl:block">
            <LiveFeed />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default TerminalLayout;
