"use client";

import { useEffect, useState } from "react";
import {
  Trophy,
  AlertTriangle,
  Newspaper,
  Dna,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Award,
} from "lucide-react";

type OracleEvent = {
  id: string;
  type: "race" | "injury" | "news";
  description: string;
  timestamp: string;
  impact: number;
};

type BreedingActivity = {
  id: string;
  type: "right_purchased" | "offspring_minted";
  description: string;
  timestamp: string;
};

type RevenueEvent = {
  id: string;
  type: "deposit" | "claim";
  description: string;
  timestamp: string;
  amount: number;
};

// On-chain demo only: events come from chain
const oracleEvents: OracleEvent[] = [];

const breedingActivity: BreedingActivity[] = [];

const revenueEvents: RevenueEvent[] = [];

const LiveFeed = () => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getEventIcon = (type: OracleEvent["type"] | BreedingActivity["type"] | RevenueEvent["type"]) => {
    switch (type) {
      case "race":
        return <Trophy className="h-3.5 w-3.5 text-terminal-amber shrink-0" />;
      case "injury":
        return <AlertTriangle className="h-3.5 w-3.5 text-terminal-red shrink-0" />;
      case "news":
        return <Newspaper className="h-3.5 w-3.5 text-terminal-cyan shrink-0" />;
      case "right_purchased":
        return <Dna className="h-3.5 w-3.5 text-primary shrink-0" />;
      case "offspring_minted":
        return <Dna className="h-3.5 w-3.5 text-terminal-amber shrink-0" />;
      case "deposit":
        return <DollarSign className="h-3.5 w-3.5 text-terminal-green shrink-0" />;
      case "claim":
        return <DollarSign className="h-3.5 w-3.5 text-terminal-cyan shrink-0" />;
      default:
        return null;
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div className="p-5 space-y-8 font-sans text-brand-ivory">
      <div>
        <h3
          className={`text-[10px] font-sans font-bold uppercase tracking-widest mb-4 flex items-center gap-2 transition-colors ${pulse ? "text-prestige-gold" : "text-muted-foreground"
            }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full bg-prestige-gold ${pulse ? "pulse-glow" : ""}`}
          />
          Live Oracle Feed
        </h3>
        <div className="space-y-2">
          {oracleEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No oracle events on chain yet.</p>
          ) : (
          oracleEvents.slice(0, 6).map((event) => (
            <div
              key={event.id}
              className={`flex items-start gap-3 p-3 rounded border border-white/5 bg-white/5 hover:bg-white/10 transition-all group ${event.type === "race" && event.description.includes("G1") ? "gold-shimmer border-prestige-gold/20" : ""
                }`}
            >
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                {getEventIcon(event.type)}
                {event.type === "race" && event.description.includes("G1") && (
                  <Award className="h-3 w-3 text-prestige-gold" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-relaxed text-brand-ivory/90 group-hover:text-brand-ivory transition-colors">
                  {event.description}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {formatTime(event.timestamp)}
                  </span>
                  <span
                    className={`text-[10px] font-bold flex items-center gap-0.5 ${event.impact >= 0 ? "text-terminal-green" : "text-terminal-red"
                      }`}
                  >
                    {event.impact >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {event.impact >= 0 ? "+" : ""}
                    {event.impact}%
                  </span>
                </div>
              </div>
            </div>
          ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Breeding Activity
        </h3>
        <div className="space-y-2">
          {breedingActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No breeding activity on chain yet.</p>
          ) : (
          breedingActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="mt-0.5 opacity-80">{getEventIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-brand-ivory/90">{activity.description}</p>
                <span className="text-[10px] text-muted-foreground font-medium mt-1 block">
                  {formatTime(activity.timestamp)}
                </span>
              </div>
            </div>
          ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Revenue Events
        </h3>
        <div className="space-y-2">
          {revenueEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No revenue events on chain yet.</p>
          ) : (
          revenueEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="mt-0.5 opacity-80">{getEventIcon(event.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-brand-ivory/90">{event.description}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {formatTime(event.timestamp)}
                  </span>
                  <span className="text-[10px] font-bold text-terminal-green tracking-wide">
                    ${event.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveFeed;

