import { Link } from "react-router-dom";
import { horses } from "@/data/mockData";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const kpis = [
  { label: "Total Market Value", value: "$24.8M", change: 2.4 },
  { label: "Total Horses", value: "12", change: null },
  { label: "Capital Locked", value: "$8.2M", change: 1.1 },
  { label: "Active Breeding", value: "7", change: null },
  { label: "24h Oracle Impact", value: "+1.8%", change: 1.8 },
];

const getHeatColor = (change: number) => {
  const intensity = Math.min(Math.abs(change) / 10, 1);
  if (change >= 0) return `hsla(160, 50%, 35%, ${0.03 + intensity * 0.12})`;
  return `hsla(350, 60%, 50%, ${0.03 + intensity * 0.12})`;
};

const getRiskLabel = (score: number) => {
  if (score <= 2) return { text: "Low", color: "text-terminal-green" };
  if (score <= 3) return { text: "Med", color: "text-terminal-amber" };
  return { text: "High", color: "text-terminal-red" };
};

const Dashboard = () => {
  const sortedByChange = [...horses].sort((a, b) => b.change24h - a.change24h);
  const gainers = sortedByChange.filter((h) => h.change24h > 0).slice(0, 5);
  const losers = sortedByChange
    .filter((h) => h.change24h < 0)
    .reverse()
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Bar */}
      <div className="grid grid-cols-5 gap-2">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-card border border-border rounded-sm pt-5 pb-3 px-4 overflow-hidden"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate mb-2.5 block">
              {kpi.label}
            </span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[1.4rem] font-mono font-bold leading-none">{kpi.value}</span>
              {kpi.change !== null && (
                <span
                  className={`text-[11px] font-mono flex items-center shrink-0 ${
                    kpi.change >= 0
                      ? "text-terminal-green"
                      : "text-terminal-red"
                  }`}
                >
                  {kpi.change >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {kpi.change >= 0 ? "+" : ""}
                  {kpi.change}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Walnut divider */}
      <div className="h-px bg-heritage-walnut/30" />

      {/* Market Heatmap */}
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Market Heatmap
        </h2>
        <div className="grid grid-cols-4 gap-1.5">
          {horses.map((horse) => {
            const risk = getRiskLabel(horse.riskScore);
            return (
              <Link
                key={horse.id}
                to={`/horses/${horse.id}`}
                className="p-3 rounded-sm border border-border hover:border-primary/50 transition-all"
                style={{ backgroundColor: getHeatColor(horse.change24h) }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">
                    {horse.name}
                  </span>
                  <span className={`text-[10px] font-mono ${risk.color}`}>
                    {risk.text}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-mono">
                    ${(horse.valuation / 1000000).toFixed(1)}M
                  </span>
                  <span
                    className={`text-xs font-mono flex items-center ${
                      horse.change24h >= 0
                        ? "text-terminal-green"
                        : "text-terminal-red"
                    }`}
                  >
                    {horse.change24h >= 0 ? "+" : ""}
                    {horse.change24h}%
                  </span>
                </div>
                <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                  BD: {horse.breedingDemand}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Walnut divider */}
      <div className="h-px bg-heritage-walnut/30" />

      {/* Gainers & Losers */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-terminal-green mb-4 flex items-center gap-2">
            <ArrowUpRight className="h-3.5 w-3.5" /> Top Gainers
          </h2>
          <div className="space-y-1">
            {gainers.map((horse) => (
              <Link
                key={horse.id}
                to={`/horses/${horse.id}`}
                className="flex items-center justify-between p-2 rounded-sm bg-card hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm">{horse.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono">
                    ${(horse.valuation / 1000000).toFixed(2)}M
                  </span>
                  <span className="text-sm font-mono text-terminal-green">
                    +{horse.change24h}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-terminal-red mb-4 flex items-center gap-2">
            <ArrowDownRight className="h-3.5 w-3.5" /> Top Decliners
          </h2>
          <div className="space-y-1">
            {losers.map((horse) => (
              <Link
                key={horse.id}
                to={`/horses/${horse.id}`}
                className="flex items-center justify-between p-2 rounded-sm bg-card hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm">{horse.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono">
                    ${(horse.valuation / 1000000).toFixed(2)}M
                  </span>
                  <span className="text-sm font-mono text-terminal-red">
                    {horse.change24h}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
