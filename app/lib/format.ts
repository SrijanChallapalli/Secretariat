/**
 * Formatting helpers for money, percentages, addresses.
 * TODO: Wire to real data sources when on-chain integration is complete.
 */

export function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatMoneyFull(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number, signed = false): string {
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

export function formatMoneyCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatPct(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function shortenHash(hash: string, head = 6, tail = 6): string {
  if (!hash || hash.length <= head + tail + 2) return hash;
  return `${hash.slice(0, head + 2)}...${hash.slice(-tail)}`;
}

export function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return isoDate;
  }
}

export function pctColorClass(value: number): string {
  if (value > 0) return "text-terminal-green";
  if (value < 0) return "text-terminal-red";
  return "text-muted-foreground";
}
