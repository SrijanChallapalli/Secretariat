import { useParams, useNavigate } from "react-router-dom";
import { horses, oracleEvents } from "@/data/mockData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight, ArrowDownRight, ArrowLeft, ShoppingCart,
  Dna, Trophy, AlertTriangle, Newspaper, Bot,
  Award, FileText, Hash, Clock
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, Radar
} from "recharts";

const HorseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const horse = horses.find((h) => h.id === Number(id));

  if (!horse) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground font-mono">Horse not found</p>
      </div>
    );
  }

  const horseEvents = oracleEvents.filter((e) => e.horseId === horse.id);
  const radarData = [
    { trait: "Speed", value: horse.traits.speed },
    { trait: "Stamina", value: horse.traits.stamina },
    { trait: "Temperament", value: horse.traits.temperament },
    { trait: "Durability", value: 100 - horse.traits.injuryRisk },
    { trait: "Pedigree", value: horse.traits.pedigreeStrength },
  ];

  const riskColor =
    horse.riskScore <= 2
      ? "text-terminal-green"
      : horse.riskScore <= 3
      ? "text-terminal-amber"
      : "text-terminal-red";

  return (
    <div className="space-y-8 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold tracking-wide">{horse.name}</h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs font-mono text-muted-foreground">
              {horse.tokenId}
            </span>
            <span className={`text-xs font-mono ${riskColor}`}>
              Risk {horse.riskScore}/5
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              Pedigree {horse.pedigreeScore}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold">
            ${(horse.valuation / 1000000).toFixed(2)}M
          </div>
          <div
            className={`flex items-center justify-end gap-1 font-mono text-sm ${
              horse.change24h >= 0 ? "text-terminal-green" : "text-terminal-red"
            }`}
          >
            {horse.change24h >= 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {horse.change24h >= 0 ? "+" : ""}
            {horse.change24h}% (24h)
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button size="sm" variant="institutional" className="text-xs">
          Buy Shares
        </Button>
        <Button size="sm" variant="secondary" className="font-mono text-xs">
          <Dna className="h-3.5 w-3.5 mr-1.5" /> Purchase Breeding Right
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="font-mono text-xs"
          onClick={() => navigate("/breeding-lab")}
        >
          <Bot className="h-3.5 w-3.5 mr-1.5" /> Open Breeding Lab
        </Button>
      </div>

      {/* Stable Record */}
      <div className="bg-heritage-walnut/20 border border-heritage-walnut-light/30 rounded-sm overflow-hidden">
        <div className="bg-heritage-walnut px-4 py-2 flex items-center gap-2">
          <Award className="h-3.5 w-3.5 text-prestige-gold" />
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-prestige-gold">
            Stable Record
          </h3>
        </div>
        <div className="p-4 grid grid-cols-5 gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Foaled</div>
            <div className="text-sm font-mono">{horse.foaled}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Sire</div>
            <div className="text-sm font-medium">{horse.sire}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Dam</div>
            <div className="text-sm font-medium">{horse.dam}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Major Result</div>
            <div className="text-sm">
              {horse.gradeWins >= 5 && <span className="text-prestige-gold glow-gold">★ </span>}
              {horse.majorResult}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Steward Note</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{horse.stewardNote}</div>
          </div>
        </div>
      </div>

      {/* Provenance Record */}
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Provenance Record
          </h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">DNA Hash</div>
            <div className="text-xs font-mono text-terminal-cyan">{horse.dnaHash}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Metadata Pointer (0G)</div>
            <div className="text-xs font-mono text-muted-foreground">{horse.tokenId}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Last Result</div>
            <div className="text-xs font-mono flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {new Date().toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Oracle Source</div>
            <div className="text-xs font-mono flex items-center gap-1">
              <Hash className="h-3 w-3 text-muted-foreground" />
              {oracleEvents.find(e => e.horseId === horse.id)?.sourceHash || "N/A"}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-card border border-border">
          <TabsTrigger
            value="overview"
            className="font-mono text-xs data-[state=active]:bg-muted"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="ownership"
            className="font-mono text-xs data-[state=active]:bg-muted"
          >
            Ownership
          </TabsTrigger>
          <TabsTrigger
            value="breeding"
            className="font-mono text-xs data-[state=active]:bg-muted"
          >
            Breeding
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="font-mono text-xs data-[state=active]:bg-muted"
          >
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
              Valuation Over Time
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={horse.valuationHistory}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(215 10% 50%)" }}
                  tickFormatter={(d) => d.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(215 10% 50%)" }}
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220 20% 10%)",
                    border: "1px solid hsl(220 15% 20%)",
                    borderRadius: "2px",
                    fontSize: "12px",
                    fontFamily: "JetBrains Mono",
                  }}
                  labelStyle={{ color: "hsl(210 15% 85%)" }}
                  formatter={(value: number) => [
                    `$${(value / 1000000).toFixed(3)}M`,
                    "Valuation",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(160 80% 38%)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Oracle Events */}
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
              Oracle Events
            </h3>
            {horseEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded</p>
            ) : (
              <div className="space-y-2">
                {horseEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded-sm hover:bg-muted/30"
                  >
                    {event.type === "race" && (
                      <Trophy className="h-4 w-4 text-terminal-amber shrink-0" />
                    )}
                    {event.type === "injury" && (
                      <AlertTriangle className="h-4 w-4 text-terminal-red shrink-0" />
                    )}
                    {event.type === "news" && (
                      <Newspaper className="h-4 w-4 text-terminal-cyan shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm">{event.description}</p>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {event.sourceHash}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono ${
                        event.impact >= 0
                          ? "text-terminal-green"
                          : "text-terminal-red"
                      }`}
                    >
                      {event.impact >= 0 ? "+" : ""}
                      {event.impact}%
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(event.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Age", value: `${horse.age} yrs` },
              { label: "Total Wins", value: horse.totalWins },
              { label: "Grade Wins", value: horse.gradeWins },
              { label: "Injuries", value: horse.injuryCount },
              { label: "Pedigree", value: horse.pedigreeScore },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-card border border-border rounded-sm p-3 text-center"
              >
                <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                  {stat.label}
                </div>
                <div className="text-lg font-mono font-bold">{stat.value}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Ownership Tab */}
        <TabsContent value="ownership" className="space-y-6 mt-4">
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
              Vault
            </h3>
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: "Shares Outstanding", value: "10,000" },
                { label: "Your Shares", value: "150" },
                {
                  label: "Share Price",
                  value: `$${(horse.valuation / 10000).toFixed(0)}`,
                },
                { label: "Revenue Claimable", value: "$2,400" },
                { label: "Est. Yield", value: "8.2%" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                    {item.label}
                  </div>
                  <div className="text-sm font-mono font-bold">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="institutional" className="text-xs">
                Buy Shares
              </Button>
              <Button size="sm" variant="secondary" className="font-mono text-xs">
                Claim Revenue
              </Button>
            </div>
          </div>

          {/* Transaction Stepper */}
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
              Trade Flow
            </h3>
            <div className="flex items-center gap-4">
              {["Approve ADI", "Buy Shares", "Confirm Receipt"].map(
                (step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-mono border ${
                        i === 0
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={`text-xs font-mono ${
                        i === 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {step}
                    </span>
                    {i < 2 && <div className="w-8 h-px bg-border" />}
                  </div>
                )
              )}
            </div>
          </div>
        </TabsContent>

        {/* Breeding Tab */}
        <TabsContent value="breeding" className="space-y-6 mt-4">
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
              Breeding Listing
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                  Stud Fee
                </div>
                <div className="text-sm font-mono font-bold">
                  ${horse.studFee.toLocaleString()} ADI
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                  Remaining Uses
                </div>
                <div className="text-sm font-mono font-bold">
                  {horse.remainingUses}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                  Allowlist
                </div>
                <div className="text-sm font-mono font-bold text-terminal-green">
                  Open
                </div>
              </div>
            </div>
            <Button size="sm" variant="institutional" className="mt-4 text-xs">
              Purchase Breeding Right
            </Button>
          </div>

          {/* AI Advisor Inline */}
          <div className="bg-card border border-primary/30 rounded-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-4 w-4 text-primary" />
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-primary">
                AI Breeding Advisor
              </h3>
            </div>
            <div className="space-y-3">
              {[
                {
                  stallion: "Golden Sovereign",
                  compatibility: 94,
                  uplift: 12.5,
                  risk: -2,
                  confidence: "High",
                },
                {
                  stallion: "Royal Fortune",
                  compatibility: 88,
                  uplift: 8.2,
                  risk: 1,
                  confidence: "High",
                },
                {
                  stallion: "Silver Arrow",
                  compatibility: 82,
                  uplift: 5.8,
                  risk: -1,
                  confidence: "Medium",
                },
              ].map((pick, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2 rounded-sm ${
                    i === 0 ? "bg-prestige-gold/5 border border-prestige-gold/20" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono ${i === 0 ? "text-prestige-gold" : "text-muted-foreground"}`}>
                      #{i + 1}
                    </span>
                    <span className="text-sm font-medium">{pick.stallion}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span>
                      Match:{" "}
                      <span className="text-primary">{pick.compatibility}</span>
                    </span>
                    <span>
                      Proj. Edge:{" "}
                      <span className="text-terminal-green">
                        +{pick.uplift}%
                      </span>
                    </span>
                    <span>
                      Soundness Δ:{" "}
                      <span
                        className={
                          pick.risk <= 0
                            ? "text-terminal-green"
                            : "text-terminal-red"
                        }
                      >
                        {pick.risk}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {pick.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="secondary"
                className="font-mono text-xs"
                onClick={() => navigate("/breeding-lab")}
              >
                Open Breeding Lab
              </Button>
              <Button size="sm" variant="institutional" className="text-xs">
                Execute With Approval
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6 mt-4">
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
              Trait Vector
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(220 15% 20%)" />
                <PolarAngleAxis
                  dataKey="trait"
                  tick={{ fontSize: 11, fill: "hsl(215 10% 50%)" }}
                />
                <Radar
                  dataKey="value"
                  stroke="hsl(160 80% 38%)"
                  fill="hsl(160 80% 38%)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
              Valuation Drivers
            </h3>
            <div className="space-y-2">
              {[
                {
                  driver: "Recent Win Impact",
                  impact: "+5.2%",
                  type: "positive",
                },
                {
                  driver: "Injury Recovery",
                  impact: "-1.8%",
                  type: "negative",
                },
                {
                  driver: "News Sentiment",
                  impact: "+2.1%",
                  type: "positive",
                },
                {
                  driver: "Breeding Premium",
                  impact: "+3.4%",
                  type: "positive",
                },
              ].map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-sm bg-muted/30"
                >
                  <span className="text-sm">{d.driver}</span>
                  <span
                    className={`text-sm font-mono ${
                      d.type === "positive"
                        ? "text-terminal-green"
                        : "text-terminal-red"
                    }`}
                  >
                    {d.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HorseDetail;
