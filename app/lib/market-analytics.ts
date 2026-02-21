/**
 * Market analytics derived from training events and listings.
 * Fetches from server /training/events when available.
 */

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

export type TrainingEvent = {
  timestamp: number;
  tokenId: number;
  eventType: string;
  valuationBefore: number;
  valuationAfter: number;
};

export type TokenValuationHistory = {
  tokenId: number;
  valuations: { t: number; v: number }[];
};

export type MarketAnalytics = {
  change24hByToken: Record<number, number>;
  change7dByToken: Record<number, number>;
  avg24hPct: number;
  avg7dPct: number;
  marketBreadth: { up: number; down: number; unchanged: number };
  topMover24h: { tokenId: number; name: string; pct: number } | null;
  bottomMover24h: { tokenId: number; name: string; pct: number } | null;
  valuationDistribution: { min: number; max: number; median: number };
  pedigreeDistribution: { avg: number; above90: number; above85: number };
  riskBreakdown: { sound: number; monitor: number; caution: number };
  breedingActivity: { listed: number; totalStudFee: number };
  oracleEventSummary: { raceResults: number; injuries: number; news: number };
};

async function fetchTrainingEvents(): Promise<TrainingEvent[]> {
  try {
    const res = await fetch(`${SERVER_URL}/training/events`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const ADI_DECIMALS = 1e18;

function toHumanVal(raw: number): number {
  return raw / ADI_DECIMALS;
}

function computeChangePct(before: number, after: number): number {
  if (before <= 0) return 0;
  return ((after - before) / before) * 100;
}

export async function computeMarketAnalytics(
  listings: { id: number; name: string; valuationUsd: number; soundness: string; studFeeUsd: number }[],
  currentValuations: Record<number, number>
): Promise<MarketAnalytics> {
  const events = await fetchTrainingEvents();
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * 24 * 60 * 60 * 1000;

  const change24hByToken: Record<number, number> = {};
  const change7dByToken: Record<number, number> = {};

  for (const tokenId of new Set([...Object.keys(currentValuations).map(Number), ...events.map((e) => e.tokenId)])) {
    const current = currentValuations[tokenId] ?? listings.find((l) => l.id === tokenId)?.valuationUsd ?? 0;

    const val24h = events
      .filter((e) => e.tokenId === tokenId && now - e.timestamp <= ms24h)
      .sort((a, b) => a.timestamp - b.timestamp);
    const val7d = events
      .filter((e) => e.tokenId === tokenId && now - e.timestamp <= ms7d)
      .sort((a, b) => a.timestamp - b.timestamp);

    const before24hRaw = val24h[0]?.valuationBefore;
    const before7dRaw = val7d[0]?.valuationBefore;
    const before24h = before24hRaw != null ? toHumanVal(before24hRaw) : current;
    const before7d = before7dRaw != null ? toHumanVal(before7dRaw) : current;

    change24hByToken[tokenId] = computeChangePct(before24h, current);
    change7dByToken[tokenId] = computeChangePct(before7d, current);
  }

  const all24h = Object.values(change24hByToken);
  const avg24hPct = all24h.length > 0 ? all24h.reduce((a, b) => a + b, 0) / all24h.length : 0;
  const all7d = Object.values(change7dByToken);
  const avg7dPct = all7d.length > 0 ? all7d.reduce((a, b) => a + b, 0) / all7d.length : 0;

  const up = all24h.filter((p) => p > 0).length;
  const down = all24h.filter((p) => p < 0).length;
  const unchanged = all24h.filter((p) => p === 0).length;

  const sorted24h = [...listings]
    .map((l) => ({ tokenId: l.id, name: l.name, pct: change24hByToken[l.id] ?? 0 }))
    .filter((x) => x.pct !== 0)
    .sort((a, b) => b.pct - a.pct);
  const topMover24h = sorted24h[0] ?? null;
  const bottomMover24h = sorted24h[sorted24h.length - 1] ?? null;

  const valuations = listings.map((l) => l.valuationUsd).filter((v) => v > 0);
  const sorted = [...valuations].sort((a, b) => a - b);
  const valuationDistribution = {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    median: sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)]! : 0,
  };

  const pedigrees = listings.map((l) => (l as { demandScore?: number }).demandScore ?? 0).filter((p) => p > 0);
  const pedigreeDistribution = {
    avg: pedigrees.length > 0 ? pedigrees.reduce((a, b) => a + b, 0) / pedigrees.length / 100 : 0,
    above90: pedigrees.filter((p) => p >= 9000).length,
    above85: pedigrees.filter((p) => p >= 8500).length,
  };

  const sound = listings.filter((l) => l.soundness === "SOUND").length;
  const monitor = listings.filter((l) => l.soundness === "MONITOR").length;
  const caution = listings.filter((l) => l.soundness === "CAUTION").length;

  const withStudFee = listings.filter((l) => l.studFeeUsd > 0);
  const breedingActivity = {
    listed: withStudFee.length,
    totalStudFee: withStudFee.reduce((a, l) => a + l.studFeeUsd, 0),
  };

  const raceResults = events.filter((e) => e.eventType === "RaceResultReported" && now - e.timestamp <= ms24h).length;
  const injuries = events.filter((e) => e.eventType === "InjuryReported" && now - e.timestamp <= ms7d).length;
  const news = events.filter((e) => e.eventType === "NewsReported" && now - e.timestamp <= ms7d).length;

  return {
    change24hByToken,
    change7dByToken,
    avg24hPct,
    avg7dPct,
    marketBreadth: { up, down, unchanged },
    topMover24h,
    bottomMover24h,
    valuationDistribution,
    pedigreeDistribution,
    riskBreakdown: { sound, monitor, caution },
    breedingActivity,
    oracleEventSummary: { raceResults, injuries, news },
  };
}
