"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem, formatEther } from "viem";
import { addresses } from "@/lib/contracts";

type FeedEvent = {
  id: string;
  type: "oracle" | "breeding" | "transfer";
  label: string;
  detail: string;
  timestamp: number;
};

const POLL_INTERVAL_MS = 15_000;
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
            newEvents.push({
              id: `race-${log.transactionHash}-${log.logIndex}`,
              type: "oracle",
              label: `Race Result #${args.tokenId}`,
              detail: `P${args.placing} — ${formatEther(args.earningsADI ?? 0n)} ADI earned`,
              timestamp: Date.now(),
            });
          }
          for (const log of injuryLogs) {
            newEvents.push({
              id: `injury-${log.transactionHash}-${log.logIndex}`,
              type: "oracle",
              label: `Injury #${log.args.tokenId}`,
              detail: `Severity ${Number(log.args.severityBps ?? 0) / 100}%`,
              timestamp: Date.now(),
            });
          }
          for (const log of newsLogs) {
            newEvents.push({
              id: `news-${log.transactionHash}-${log.logIndex}`,
              type: "oracle",
              label: `News #${log.args.tokenId}`,
              detail: `Sentiment ${Number(log.args.sentimentBps ?? 0) / 100}%`,
              timestamp: Date.now(),
            });
          }
        }

        if (addresses.breedingMarketplace && addresses.breedingMarketplace !== "0x0000000000000000000000000000000000000000") {
          const [bredLogs, brLogs] = await Promise.all([
            client.getLogs({ address: addresses.breedingMarketplace, event: bredEvent, fromBlock, toBlock: currentBlock }).catch(() => []),
            client.getLogs({ address: addresses.breedingMarketplace, event: breedingRightEvent, fromBlock, toBlock: currentBlock }).catch(() => []),
          ]);

          for (const log of bredLogs) {
            newEvents.push({
              id: `bred-${log.transactionHash}-${log.logIndex}`,
              type: "breeding",
              label: `Offspring minted`,
              detail: `Sire #${log.args.stallionId} × Mare #${log.args.mareId} → #${log.args.offspringId}`,
              timestamp: Date.now(),
            });
          }
          for (const log of brLogs) {
            newEvents.push({
              id: `br-${log.transactionHash}-${log.logIndex}`,
              type: "breeding",
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
            newEvents.push({
              id: `transfer-${log.transactionHash}-${log.logIndex}`,
              type: "transfer",
              label: isMint ? `Horse #${log.args.tokenId} minted` : `Horse #${log.args.tokenId} transferred`,
              detail: isMint ? `To ${to.slice(0, 8)}…` : `${from.slice(0, 8)}… → ${to.slice(0, 8)}…`,
              timestamp: Date.now(),
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
    return () => { active = false; clearInterval(interval); };
  }, [client]);

  const oracleEvents = events.filter((e) => e.type === "oracle");
  const breedingEvents = events.filter((e) => e.type === "breeding");
  const transferEvents = events.filter((e) => e.type === "transfer");

  return (
    <div className="p-5 space-y-8 font-sans text-brand-ivory">
      <section>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
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
              <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded bg-white/[0.02] border border-white/5 text-xs">
                <span className="text-brand-ivory font-medium">{e.label}</span>
                <span className="text-muted-foreground">{e.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Breeding Activity
        </h3>
        {breedingEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">No breeding activity on chain yet.</p>
        ) : (
          <div className="space-y-2">
            {breedingEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded bg-white/[0.02] border border-white/5 text-xs">
                <span className="text-brand-ivory font-medium">{e.label}</span>
                <span className="text-muted-foreground">{e.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Transfers &amp; Mints
        </h3>
        {transferEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">No transfer events on chain yet.</p>
        ) : (
          <div className="space-y-2">
            {transferEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded bg-white/[0.02] border border-white/5 text-xs">
                <span className="text-brand-ivory font-medium">{e.label}</span>
                <span className="text-muted-foreground">{e.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
