/**
 * Portfolio UI types. Data comes from on-chain vault + horse ownership only.
 */

export interface PortfolioHolding {
  asset: string;
  horseId: number;
  shares: bigint;
  totalShares: bigint;
  value: bigint;
  pnlPct: number;
  claimable: bigint;
  isOwnerOnly: boolean;
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
  shares: bigint;
  value: bigint;
}

export interface RevenueBreakdownItem {
  asset: string;
  horseId: number;
  claimable: bigint;
}
