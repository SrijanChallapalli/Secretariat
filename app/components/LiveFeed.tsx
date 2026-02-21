"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Crown,
  AlertTriangle,
  Newspaper,
  Sparkles,
  Ticket,
  Baby,
  ArrowRightLeft,
} from "lucide-react";
import { usePublicClient, useReadContracts } from "wagmi";
import { parseAbiItem, formatEther } from "viem";
import { addresses, abis } from "@/lib/contracts";
import { parseRawHorseData } from "@/lib/on-chain-mapping";

export type EventKind =
  | "race_winner"
  | "race"
  | "injury"
  | "news"
  | "mint"
  | "breeding_right"
  | "offspring_minted"
  | "transfer";

type FeedEvent = {
  id: string;
  type: "oracle" | "breeding" | "transfer";
  eventKind: EventKind;
  label: string;
  detail: string;
  timestamp: number;
  tokenId?: number;
};

const EVENT_PILL_CONFIG: Record<
  EventKind,
  { icon: React.ComponentType<{ className?: string }>; label: string; pillClass: string }
> = {
  race_winner: {
    icon: Crown,
    label: "Winner",
    pillClass: "text-prestige-gold bg-prestige-gold/15 border-prestige-gold/30",
  },
  race: {
    icon: Trophy,
    label: "Race",
    pillClass: "text-terminal-amber bg-terminal-amber/15 border-terminal-amber/30",
  },
  injury: {
    icon: AlertTriangle,
    label: "Injury",
    pillClass: "text-terminal-red bg-terminal-red/15 border-terminal-red/30",
  },
  news: {
    icon: Newspaper,
    label: "News",
    pillClass: "text-terminal-cyan bg-terminal-cyan/15 border-terminal-cyan/30",
  },
  mint: {
    icon: Sparkles,
    label: "Minted",
    pillClass: "text-terminal-green bg-terminal-green/15 border-terminal-green/30",
  },
  breeding_right: {
    icon: Ticket,
    label: "Breeding Right",
    pillClass: "text-primary bg-primary/15 border-primary/30",
  },
  offspring_minted: {
    icon: Baby,
    label: "Offspring",
    pillClass: "text-prestige-gold bg-prestige-gold/15 border-prestige-gold/30",
  },
  transfer: {
    icon: ArrowRightLeft,
    label: "Transfer",
    pillClass: "text-muted-foreground bg-white/10 border-white/20",
  },
};

const POLL_INTERVAL_MS = 5_000;
const BLOCKS_TO_SCAN = 500n;

const raceResultEvent = parseAbiItem(
  "event RaceResultReported(uint256 indexed tokenId, uint8 placing, uint256 earningsADI)"
);
const injuryEvent = parseAbiItem(
  "event InjuryReported(uint256 indexed tokenId, uint16 severityBps)"
);
const newsEvent = parseAbiItem(
  "event NewsReported(uint256 indexed tokenId, uint16 sentimentBps)"
);
const bredEvent = parseAbiItem(
  "event Bred(uint256 indexed stallionId, uint256 indexed mareId, uint256 indexed offspringId)"
);
const breedingRightEvent = parseAbiItem(
  "event BreedingRightPurchased(uint256 indexed stallionId, address buyer, uint256 expiry, bytes32 seed)"
);
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function EventItem({
  event,
  displayName,
  href,
}: {
  event: FeedEvent;
  displayName?: string;
  href?: string;
}) {
  const config = EVENT_PILL_CONFIG[event.eventKind];
  const Icon = config.icon;
  const label = displayName ?? event.label;
  const isWinner = event.eventKind === "race_winner";
  const content = (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border border-sidebar-border/60 bg-card/80 hover:bg-card hover:border-prestige-gold/20 transition-all duration-200 group ${
        isWinner ? "gold-shimmer" : ""
      }`}
    >
      <span
        className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-medium uppercase tracking-wider ${config.pillClass}`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{event.detail}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

export default function LiveFeed() {
  const client = usePublicClient();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [lastPoll, setLastPoll] = useState<number>(0);

  useEffect(() => {
    if (!client) return;
    let active = true;

    async function poll() {
      if (!client) return;
      try {
        const currentBlock = await client.getBlockNumber();
        const fromBlock = currentBlock > BLOCKS_TO_SCAN ? currentBlock - BLOCKS_TO_SCAN : 0n;
        const newEvents: FeedEvent[] = [];

        if (addresses.horseOracle && addresses.horseOracle !== "0x0000000000000000000000000000000000000000") {
          const [raceLogs, injuryLogs, newsLogs] = await Promise.all([
            client.getLogs({ address: addresses.horseOracle, event: raceResultEvent, fromBlock, toBlock: currentBlock }).catch(() => []),
            client.getLogs({ address: addresses.horseOracle, event: injuryEvent, fromBlock, toBlock: currentBlock }).catch(() => []),
            client.getLogs({ address: addresses.horseOracle, event: newsEvent, fromBlock, toBlock: currentBlock }).catch(() => []),
          ]);

          for (const log of raceLogs) {
            const args = log.args;
            const placing = Number(args.placing ?? 0);
            newEvents.push({
              id: `race-${log.transactionHash}-${log.logIndex}`,
              type: "oracle",
              eventKind: placing === 1 ? "race_winner" : "race",
              label: placing === 1 ? `Winner #${args.tokenId}` : `Race Result #${args.tokenId}`,
              detail: `P${placing} — ${formatEther(args.earningsADI ?? 0n)} ADI earned`,
              timestamp: Date.now(),
              tokenId: Number(args.tokenId ?? 0),
            });
          }
          for (const log of injuryLogs) {
            newEvents.push({
              id: `injury-${log.transactionHash}-${log.logIndex}`,
              type: "oracle",
              eventKind: "injury",
              label: `Injury #${log.args.tokenId}`,
              detail: `Severity ${Number(log.args.severityBps ?? 0) / 100}%`,
              timestamp: Date.now(),
              tokenId: Number(log.args.tokenId ?? 0),
            });
          }
          for (const log of newsLogs) {
            newEvents.push({
              id: `news-${log.transactionHash}-${log.logIndex}`,
              type: "oracle",
              eventKind: "news",
              label: `News #${log.args.tokenId}`,
              detail: `Sentiment ${Number(log.args.sentimentBps ?? 0) / 100}%`,
              timestamp: Date.now(),
              tokenId: Number(log.args.tokenId ?? 0),
            });
          }
        }

        if (addresses.breedingMarketplace && addresses.breedingMarketplace !== "0x0000000000000000000000000000000000000000") {
          const [bredLogs, brLogs] = await Promise.all([
            client.getLogs({ address: addresses.breedingMarketplace, event: bredEvent, fromBlock, toBlock: currentBlock }).catch(() => []),
            client.getLogs({ address: addresses.breedingMarketplace, event: breedingRightEvent, fromBlock, toBlock: currentBlock }).catch(() => []),
          ]);

          for (const log of bredLogs) {
            const offspringId = Number(log.args.offspringId ?? 0);
            newEvents.push({
              id: `bred-${log.transactionHash}-${log.logIndex}`,
              type: "breeding",
              eventKind: "offspring_minted",
              label: `Offspring minted`,
              detail: `Sire #${log.args.stallionId} × Mare #${log.args.mareId} → #${offspringId}`,
              timestamp: Date.now(),
              tokenId: offspringId,
            });
          }
          for (const log of brLogs) {
            newEvents.push({
              id: `br-${log.transactionHash}-${log.logIndex}`,
              type: "breeding",
              eventKind: "breeding_right",
              label: `Breeding right purchased`,
              detail: `Stallion #${log.args.stallionId} by ${String(log.args.buyer ?? "").slice(0, 8)}…`,
              timestamp: Date.now(),
            });
          }
        }

        if (addresses.horseINFT && addresses.horseINFT !== "0x0000000000000000000000000000000000000000") {
          const transferLogs = await client.getLogs({
            address: addresses.horseINFT,
            event: transferEvent,
            fromBlock,
            toBlock: currentBlock,
          }).catch(() => []);

          for (const log of transferLogs) {
            const from = String(log.args.from ?? "");
            const to = String(log.args.to ?? "");
            const isMint = from === "0x0000000000000000000000000000000000000000";
            const tokenId = Number(log.args.tokenId ?? 0);
            newEvents.push({
              id: `transfer-${log.transactionHash}-${log.logIndex}`,
              type: "transfer",
              eventKind: isMint ? "mint" : "transfer",
              label: isMint ? `Horse #${tokenId} minted` : `Horse #${tokenId} transferred`,
              detail: isMint ? `To ${to.slice(0, 8)}…` : `${from.slice(0, 8)}… → ${to.slice(0, 8)}…`,
              timestamp: Date.now(),
              tokenId,
            });
          }
        }

        if (active) {
          setEvents(newEvents.slice(-30).reverse());
          setLastPoll(Date.now());
        }
      } catch {
        // silently retry next poll
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    const onMinted = () => { poll(); };
    window.addEventListener("secretariat-horse-minted", onMinted);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("secretariat-horse-minted", onMinted);
    };
  }, [client]);

  const oracleEvents = events.filter((e) => e.type === "oracle");
  const breedingEvents = events.filter((e) => e.type === "breeding");
  const transferEvents = events.filter((e) => e.type === "transfer");

  const transferTokenIds = [...new Set(
    transferEvents.map((e) => e.tokenId).filter((id): id is number => id != null)
  )];
  const horseDataCalls = transferTokenIds.map((tokenId) => ({
    address: addresses.horseINFT,
    abi: abis.HorseINFT,
    functionName: "getHorseData" as const,
    args: [BigInt(tokenId)] as [bigint],
  }));
  const { data: horseDataResults } = useReadContracts({
    contracts: horseDataCalls as any,
  });
  const horseNames: Record<number, string> = {};
  horseDataResults?.forEach((res, i) => {
    const tokenId = transferTokenIds[i];
    if (tokenId != null && res?.status === "success") {
      const raw = parseRawHorseData(res.result);
      horseNames[tokenId] = raw?.name?.trim() || `Horse #${tokenId}`;
    }
  });

  return (
    <div className="p-5 space-y-8 font-sans text-brand-ivory">
      <section>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-prestige-gold mb-4 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-prestige-gold animate-pulse" />
          Live Oracle Feed
          {lastPoll > 0 && (
            <span className="text-[9px] font-normal text-muted-foreground/60 ml-auto">
              updated {timeAgo(lastPoll)}
            </span>
          )}
        </h3>
        {oracleEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">No oracle events on chain yet.</p>
        ) : (
          <div className="space-y-2">
            {oracleEvents.map((e) => (
              <EventItem
                key={e.id}
                event={e}
                href={e.tokenId != null ? `/horse/${e.tokenId}` : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-prestige-gold mb-4">
          Breeding Activity
        </h3>
        {breedingEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">No breeding activity on chain yet.</p>
        ) : (
          <div className="space-y-2">
            {breedingEvents.map((e) => (
              <EventItem
                key={e.id}
                event={e}
                href={e.tokenId != null ? `/horse/${e.tokenId}` : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-prestige-gold mb-4">
          Transfers &amp; Mints
        </h3>
        {transferEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">No transfer events on chain yet.</p>
        ) : (
          <div className="space-y-2">
            {transferEvents.map((e) => {
              const displayName =
                e.tokenId != null
                  ? (horseNames[e.tokenId] ?? `Horse #${e.tokenId}`)
                  : e.label.split(" ")[0];
              const suffix = e.label.includes("minted") ? "minted" : "transferred";
              const transferLabel = `${displayName} ${suffix}`;
              return (
                <EventItem
                  key={e.id}
                  event={e}
                  displayName={transferLabel}
                  href={e.tokenId != null ? `/horse/${e.tokenId}` : undefined}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
