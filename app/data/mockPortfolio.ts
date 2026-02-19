/**
 * Portfolio UI types. Data comes from on-chain vault + horse ownership only.
 */

export interface PortfolioHolding {
  asset: string;
  horseId: number;
  shares: number;
  totalShares: number;
  value: number;
  pnlPct: number;
  claimable: number;
}

export interface PortfolioKPIs {
  totalValue: number;
  totalValueDeltaPct: number;
  claimableRevenue: number;
  activeRights: number;
  avgReturn: number;
  avgReturnDeltaPct: number;
}

export interface TopPerformer {
  asset: string;
  horseId: number;
  pnlPct: number;
  shares: number;
  value: number;
}

export interface RevenueBreakdownItem {
  asset: string;
  horseId: number;
  claimable: number;
}
