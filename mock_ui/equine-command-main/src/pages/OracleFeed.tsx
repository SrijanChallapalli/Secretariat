import { useState } from "react";
import { oracleEvents } from "@/data/mockData";
import {
  Trophy, AlertTriangle, Newspaper,
  ArrowUpRight, ArrowDownRight, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";

type EventFilter = "all" | "race" | "injury" | "news";

const OracleFeed = () => {
  const [filter, setFilter] = useState<EventFilter>("all");
  const filtered =
    filter === "all"
      ? oracleEvents
      : oracleEvents.filter((e) => e.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case "race":
        return <Trophy className="h-4 w-4 text-terminal-amber shrink-0" />;
      case "injury":
        return <AlertTriangle className="h-4 w-4 text-terminal-red shrink-0" />;
      case "news":
        return <Newspaper className="h-4 w-4 text-terminal-cyan shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium tracking-wide">Oracle Feed</h1>
        <div className="flex gap-1">
          {(["all", "race", "injury", "news"] as EventFilter[]).map((f) => {
            const label = f === "race" ? "Official Result" : f === "injury" ? "Veterinary" : f === "news" ? "Track Bulletin" : "All";
            return (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "secondary"}
                className="font-mono text-xs h-7"
                onClick={() => setFilter(f)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-4 p-3 bg-card border border-border rounded-sm hover:bg-muted/30 transition-colors"
          >
            {getIcon(event.type)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{event.horseName}</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                  {event.type === "race" ? "Official Result" : event.type === "injury" ? "Veterinary" : "Track Bulletin"}
                </span>
                {event.type === "race" && event.description.includes("G1") && (
                  <Award className="h-3.5 w-3.5 text-prestige-gold" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {event.description}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`text-sm font-mono flex items-center gap-0.5 ${
                  event.impact >= 0
                    ? "text-terminal-green"
                    : "text-terminal-red"
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
              <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                {new Date(event.timestamp).toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              {event.sourceHash}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OracleFeed;
