import { useState, useEffect } from "react";
import { oracleEvents, breedingActivity, revenueEvents } from "@/data/mockData";
import {
  Trophy, AlertTriangle, Newspaper, Dna,
  DollarSign, ArrowUpRight, ArrowDownRight, Award
} from "lucide-react";

const LiveFeed = () => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "race": return <Trophy className="h-3.5 w-3.5 text-terminal-amber shrink-0" />;
      case "injury": return <AlertTriangle className="h-3.5 w-3.5 text-terminal-red shrink-0" />;
      case "news": return <Newspaper className="h-3.5 w-3.5 text-terminal-cyan shrink-0" />;
      case "right_purchased": return <Dna className="h-3.5 w-3.5 text-primary shrink-0" />;
      case "offspring_minted": return <Dna className="h-3.5 w-3.5 text-terminal-amber shrink-0" />;
      case "deposit": return <DollarSign className="h-3.5 w-3.5 text-terminal-green shrink-0" />;
      case "claim": return <DollarSign className="h-3.5 w-3.5 text-terminal-cyan shrink-0" />;
      default: return null;
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Oracle Events */}
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

      {/* Breeding Activity */}
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

      {/* Revenue Events */}
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
