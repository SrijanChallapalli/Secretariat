import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { horses } from "@/data/mockData";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import { ArrowUpDown, Search, ArrowUpRight, ArrowDownRight, Award } from "lucide-react";

type SortKey = "name" | "valuation" | "change24h" | "riskScore" | "totalWins" | "studFee" | "remainingUses" | "breedingDemand";

const Market = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valuation");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let result = horses.filter((h) =>
      h.name.toLowerCase().includes(search.toLowerCase())
    );
    result.sort((a, b) => {
      if (sortKey === "name") {
        return sortAsc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortAsc ? av - bv : bv - av;
    });
    return result;
  }, [search, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="cursor-pointer hover:text-foreground transition-colors text-[10px] font-mono uppercase tracking-wider"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium tracking-wide">Market</h1>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter horses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 bg-card border-border text-sm font-mono"
          />
        </div>
      </div>

      <div className="border border-border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <SortHeader label="Horse" field="name" />
              <SortHeader label="Valuation" field="valuation" />
              <SortHeader label="24h" field="change24h" />
              <SortHeader label="Soundness" field="riskScore" />
              <SortHeader label="Wins" field="totalWins" />
              <SortHeader label="Stud Fee" field="studFee" />
              <SortHeader label="Uses" field="remainingUses" />
              <SortHeader label="Demand" field="breedingDemand" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((horse) => (
              <TableRow
                key={horse.id}
                className="cursor-pointer hover:bg-muted/50 border-border transition-colors"
                onClick={() => navigate(`/horses/${horse.id}`)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: horse.silksColor }}
                    />
                    {horse.name}
                    {horse.gradeWins >= 5 && (
                      <Award className="h-3.5 w-3.5 text-prestige-gold shrink-0" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono">
                  ${(horse.valuation / 1000000).toFixed(2)}M
                </TableCell>
                <TableCell>
                  <span
                    className={`font-mono flex items-center gap-0.5 ${
                      horse.change24h >= 0
                        ? "text-terminal-green"
                        : "text-terminal-red"
                    }`}
                  >
                    {horse.change24h >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {horse.change24h >= 0 ? "+" : ""}
                    {horse.change24h}%
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`font-mono text-xs px-1.5 py-0.5 rounded-sm ${
                      horse.riskScore <= 2
                        ? "bg-terminal-green/10 text-terminal-green"
                        : horse.riskScore <= 3
                        ? "bg-terminal-amber/10 text-terminal-amber"
                        : "bg-terminal-red/10 text-terminal-red"
                    }`}
                  >
                    {horse.riskScore}/5
                  </span>
                </TableCell>
                <TableCell className="font-mono">{horse.totalWins}</TableCell>
                <TableCell className="font-mono">
                  ${horse.studFee.toLocaleString()}
                </TableCell>
                <TableCell className="font-mono">
                  {horse.remainingUses}
                </TableCell>
                <TableCell className="font-mono">
                  {horse.breedingDemand}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Market;
