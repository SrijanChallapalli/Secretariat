import { portfolioHoldings } from "@/data/mockData";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const Portfolio = () => {
  const totalValue = portfolioHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalClaimable = portfolioHoldings.reduce((sum, h) => sum + h.claimable, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-lg font-medium tracking-wide">Portfolio</h1>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Value", value: `$${totalValue.toLocaleString()}` },
          { label: "Claimable Revenue", value: `$${totalClaimable.toLocaleString()}` },
          { label: "Active Rights", value: "2" },
          { label: "Recent Actions", value: "5" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-sm p-3">
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
              {kpi.label}
            </div>
            <div className="text-lg font-mono font-bold">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[10px] font-mono uppercase">Asset</TableHead>
              <TableHead className="text-[10px] font-mono uppercase">Shares</TableHead>
              <TableHead className="text-[10px] font-mono uppercase">Value</TableHead>
              <TableHead className="text-[10px] font-mono uppercase">PnL</TableHead>
              <TableHead className="text-[10px] font-mono uppercase">Claimable</TableHead>
              <TableHead className="text-[10px] font-mono uppercase">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {portfolioHoldings.map((h) => (
              <TableRow key={h.horseId} className="border-border">
                <TableCell className="font-medium">{h.horseName}</TableCell>
                <TableCell className="font-mono">
                  {h.shares}/{h.totalShares}
                </TableCell>
                <TableCell className="font-mono">
                  ${h.currentValue.toLocaleString()}
                </TableCell>
                <TableCell>
                  <span
                    className={`font-mono flex items-center gap-0.5 ${
                      h.pnl >= 0 ? "text-terminal-green" : "text-terminal-red"
                    }`}
                  >
                    {h.pnl >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {h.pnl >= 0 ? "+" : ""}
                    {h.pnl}%
                  </span>
                </TableCell>
                <TableCell className="font-mono text-terminal-green">
                  ${h.claimable.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="font-mono text-xs h-7"
                  >
                    Claim
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Portfolio;
