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

const oracleEvents: OracleEvent[] = [
  {
    id: "1",
    type: "race",
    description: "G1: Secretariat’s Pride wins at Belmont by 3L",
    timestamp: new Date().toISOString(),
    impact: 4.2,
  },
  {
    id: "2",
    type: "injury",
    description: "Training setback reported for Derby Prospect #12",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    impact: -2.1,
  },
  {
    id: "3",
    type: "news",
    description: "Stud book opens new cross-border syndicate window",
    timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    impact: 1.3,
  },
];

const breedingActivity: BreedingActivity[] = [
  {
    id: "b1",
    type: "right_purchased",
    description: "Breeding right purchased: Stallion #2 → Mare #5",
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    id: "b2",
    type: "offspring_minted",
    description: "Offspring minted: Token #18 (G1 x G2 cross)",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
];

const revenueEvents: RevenueEvent[] = [
  {
    id: "r1",
    type: "deposit",
    description: "Vault #3 distribution deposited",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    amount: 12450,
  },
  {
    id: "r2",
    type: "claim",
    description: "LP claimed fees from Marketplace pool",
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    amount: 3820,
  },
];

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
    <div className="p-4 space-y-6">
      <div>
        <h3
          className={`text-[10px] font-mono uppercase tracking-wider mb-3 flex items-center gap-2 transition-colors ${
            pulse ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full bg-primary ${pulse ? "pulse-glow" : ""}`}
          />
          Live Oracle Feed
        </h3>
        <div className="space-y-1.5">
          {oracleEvents.slice(0, 6).map((event) => (
            <div
              key={event.id}
              className={`flex items-start gap-2 p-2 rounded-sm bg-card hover:bg-muted/50 transition-colors ${
                event.type === "race" && event.description.includes("G1") ? "gold-shimmer" : ""
              }`}
            >
              <div className="flex items-center gap-1 shrink-0">
                {getEventIcon(event.type)}
                {event.type === "race" && event.description.includes("G1") && (
                  <Award className="h-3 w-3 text-prestige-gold" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{event.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatTime(event.timestamp)}
                  </span>
                  <span
                    className={`text-[10px] font-mono flex items-center ${
                      event.impact >= 0 ? "text-terminal-green" : "text-terminal-red"
                    }`}
                  >
                    {event.impact >= 0 ? (
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    ) : (
                      <ArrowDownRight className="h-2.5 w-2.5" />
                    )}
                    {event.impact >= 0 ? "+" : ""}
                    {event.impact}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Breeding Activity
        </h3>
        <div className="space-y-1.5">
          {breedingActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-2 p-2 rounded-sm bg-card"
            >
              {getEventIcon(activity.type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{activity.description}</p>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formatTime(activity.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Revenue Events
        </h3>
        <div className="space-y-1.5">
          {revenueEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-2 p-2 rounded-sm bg-card"
            >
              {getEventIcon(event.type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{event.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatTime(event.timestamp)}
                  </span>
                  <span className="text-[10px] font-mono text-terminal-green">
                    ${event.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveFeed;

