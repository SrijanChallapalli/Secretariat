"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { formatEther, parseEther } from "viem";
import {
  ShieldAlert,
  Activity,
  Heart,
  TrendingDown,
  Gauge,
  AlertTriangle,
} from "lucide-react";

export default function RiskBoardPage() {
  const { address } = useAccount();
  const [horseId, setHorseId] = useState("0");
  const [vaultAddr, setVaultAddr] = useState<`0x${string}` | null>(null);

  // Form state for risk parameters
  const [minValuation, setMinValuation] = useState("100");
  const [maxDrawdown, setMaxDrawdown] = useState("2000");
  const [maxPosition, setMaxPosition] = useState("5000");
  const [healthThreshold, setHealthThreshold] = useState("40");
  const [strideDelta, setStrideDelta] = useState("500");
  const [stopLossEnabled, setStopLossEnabled] = useState(true);
  const [autoRetire, setAutoRetire] = useState(true);

  const { data: resolvedVault } = useReadContract({
    address: addresses.syndicateVaultFactory,
    abi: abis.HorseSyndicateVaultFactory,
    functionName: "vaultForHorse",
    args: [BigInt(horseId || 0)],
  });

  const vault =
    resolvedVault &&
    resolvedVault !== "0x0000000000000000000000000000000000000000"
      ? resolvedVault
      : vaultAddr;

  const { data: riskParams } = useReadContract({
    address: addresses.agentRiskConfig,
    abi: abis.AgentRiskConfig,
    functionName: "getRiskParams",
    args: vault ? [vault] : undefined,
  });

  const { data: horseData } = useReadContract({
    address: addresses.horseINFT,
    abi: abis.HorseINFT,
    functionName: "getHorseData",
    args: [BigInt(horseId || 0)],
  });

  const { data: stopLossBreached } = useReadContract({
    address: addresses.agentRiskConfig,
    abi: abis.AgentRiskConfig,
    functionName: "isStopLossBreached",
    args:
      vault && horseData
        ? [vault, (horseData as any).valuationADI ?? 0n]
        : undefined,
  });

  const { data: drawdownBreached } = useReadContract({
    address: addresses.agentRiskConfig,
    abi: abis.AgentRiskConfig,
    functionName: "isDrawdownBreached",
    args:
      vault && horseData
        ? [vault, (horseData as any).valuationADI ?? 0n]
        : undefined,
  });

  // Biometric readings
  const { data: strideBiometric } = useReadContract({
    address: addresses.horseOracle,
    abi: abis.HorseOracle,
    functionName: "getLatestBiometric",
    args: [BigInt(horseId || 0), 0],
  });

  const { data: heartBiometric } = useReadContract({
    address: addresses.horseOracle,
    abi: abis.HorseOracle,
    functionName: "getLatestBiometric",
    args: [BigInt(horseId || 0), 1],
  });

  const { data: gaitBiometric } = useReadContract({
    address: addresses.horseOracle,
    abi: abis.HorseOracle,
    functionName: "getLatestBiometric",
    args: [BigInt(horseId || 0), 2],
  });

  const { writeContract } = useWriteContract();

  const params = riskParams as any;
  const currentValuation = horseData
    ? formatEther((horseData as any).valuationADI ?? 0n)
    : "—";

  function saveRiskParams() {
    if (!vault) return;
    writeContract({
      address: addresses.agentRiskConfig,
      abi: abis.AgentRiskConfig,
      functionName: "setRiskParams",
      args: [
        vault,
        parseEther(minValuation),
        Number(maxDrawdown),
        Number(maxPosition),
        Number(healthThreshold),
        Number(strideDelta),
        stopLossEnabled,
        autoRetire,
      ],
    });
  }

  function formatBiometric(data: any) {
    if (!data || !data.timestamp || data.timestamp === 0n)
      return { value: "—", deviation: "—", time: "—" };
    return {
      value: String(data.value),
      deviation: `${Number(data.deviationBps) / 100}%`,
      time: new Date(Number(data.timestamp) * 1000).toLocaleTimeString(),
    };
  }

  const stride = formatBiometric(strideBiometric);
  const heart = formatBiometric(heartBiometric);
  const gait = formatBiometric(gaitBiometric);

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide text-foreground flex items-center gap-2">
          <Gauge className="h-6 w-6 text-prestige-gold" />
          DeFAI Risk Board
        </h1>
        <p className="text-sm text-muted-foreground">
          Define the mathematically rigid borders within which the AI agent
          operates. Set biological thresholds, position sizing, and hard
          stop-loss limits.
        </p>
      </header>

      {/* Horse selector */}
      <section className="rounded-sm border border-border bg-card p-4 space-y-3">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Select Horse
        </label>
        <div className="flex gap-3 items-center">
          <input
            type="number"
            min={0}
            className="w-28 px-3 py-2 rounded-sm bg-secondary border border-border text-sm font-mono"
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
            placeholder="Token ID"
          />
          <span className="text-sm text-muted-foreground">
            {vault ? (
              <>
                Vault:{" "}
                <span className="font-mono text-xs">
                  {vault.slice(0, 8)}...{vault.slice(-6)}
                </span>
              </>
            ) : (
              "No vault found"
            )}
          </span>
          <span className="text-sm">
            Valuation:{" "}
            <span className="font-mono text-prestige-gold">
              {currentValuation} ADI
            </span>
          </span>
        </div>
      </section>

      {/* Alert status */}
      {(stopLossBreached || drawdownBreached) && (
        <section className="rounded-sm border border-red-500/50 bg-red-950/20 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-300">
              Risk Breach Detected
            </p>
            <p className="text-xs text-red-400/70">
              {stopLossBreached && "Valuation floor breached. "}
              {drawdownBreached && "Max drawdown exceeded. "}
              The AI agent will execute protective actions.
            </p>
          </div>
        </section>
      )}

      {/* Current parameters display */}
      {params && (
        <section className="rounded-sm border border-border bg-card p-4 space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            Active Risk Parameters
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Min Valuation</p>
              <p className="font-mono text-sm">
                {formatEther(params.minValuationADI ?? 0n)} ADI
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Drawdown</p>
              <p className="font-mono text-sm">
                {Number(params.maxDrawdownBps ?? 0) / 100}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Peak Valuation</p>
              <p className="font-mono text-sm">
                {formatEther(params.peakValuation ?? 0n)} ADI
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Health Floor</p>
              <p className="font-mono text-sm">
                {String(params.healthThreshold ?? 0)}/100
              </p>
            </div>
          </div>
          <div className="flex gap-4 text-xs">
            <span
              className={
                params.stopLossEnabled
                  ? "text-terminal-green"
                  : "text-muted-foreground"
              }
            >
              Stop-Loss: {params.stopLossEnabled ? "ARMED" : "OFF"}
            </span>
            <span
              className={
                params.autoRetireOnHealth
                  ? "text-terminal-green"
                  : "text-muted-foreground"
              }
            >
              Auto-Retire: {params.autoRetireOnHealth ? "ARMED" : "OFF"}
            </span>
          </div>
        </section>
      )}

      {/* Biometric feeds */}
      <section className="rounded-sm border border-border bg-card p-4 space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Activity className="h-3 w-3" /> Live Biometric Feed
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-sm bg-secondary/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" /> Stride Length
            </p>
            <p className="font-mono text-lg">{stride.value}</p>
            <p className="text-xs text-muted-foreground">
              Deviation: {stride.deviation} · {stride.time}
            </p>
          </div>
          <div className="rounded-sm bg-secondary/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Heart className="h-3 w-3" /> Heart Rate
            </p>
            <p className="font-mono text-lg">{heart.value}</p>
            <p className="text-xs text-muted-foreground">
              Deviation: {heart.deviation} · {heart.time}
            </p>
          </div>
          <div className="rounded-sm bg-secondary/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Gait Symmetry
            </p>
            <p className="font-mono text-lg">{gait.value}</p>
            <p className="text-xs text-muted-foreground">
              Deviation: {gait.deviation} · {gait.time}
            </p>
          </div>
        </div>
      </section>

      {/* Risk parameter sliders / configurator */}
      {address && vault && (
        <section className="rounded-sm border border-border bg-card p-4 space-y-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ShieldAlert className="h-3 w-3" /> Configure Risk Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Min Valuation (ADI) — hard stop-loss floor
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 rounded-sm bg-secondary border border-border text-sm font-mono"
                value={minValuation}
                onChange={(e) => setMinValuation(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Max Drawdown (bps) — {Number(maxDrawdown) / 100}% from peak
              </label>
              <input
                type="range"
                min={0}
                max={5000}
                step={100}
                className="w-full accent-prestige-gold"
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(e.target.value)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span className="font-mono">
                  {Number(maxDrawdown) / 100}%
                </span>
                <span>50%</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Max Position Size (bps) — {Number(maxPosition) / 100}% of
                portfolio
              </label>
              <input
                type="range"
                min={0}
                max={10000}
                step={100}
                className="w-full accent-prestige-gold"
                value={maxPosition}
                onChange={(e) => setMaxPosition(e.target.value)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span className="font-mono">
                  {Number(maxPosition) / 100}%
                </span>
                <span>100%</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Health Threshold — below {healthThreshold}/100 triggers action
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="w-full accent-prestige-gold"
                value={healthThreshold}
                onChange={(e) => setHealthThreshold(e.target.value)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span className="font-mono">{healthThreshold}</span>
                <span>100</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Stride Anomaly Threshold (bps) —{" "}
                {Number(strideDelta) / 100}% deviation
              </label>
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                className="w-full accent-prestige-gold"
                value={strideDelta}
                onChange={(e) => setStrideDelta(e.target.value)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1%</span>
                <span className="font-mono">
                  {Number(strideDelta) / 100}%
                </span>
                <span>20%</span>
              </div>
            </div>

            <div className="space-y-3 flex flex-col justify-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={stopLossEnabled}
                  onChange={(e) => setStopLossEnabled(e.target.checked)}
                  className="accent-prestige-gold"
                />
                <span>Enable Stop-Loss</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRetire}
                  onChange={(e) => setAutoRetire(e.target.checked)}
                  className="accent-prestige-gold"
                />
                <span>Auto-Retire on Health Breach</span>
              </label>
            </div>
          </div>

          <button
            className="px-6 py-2 rounded-sm bg-prestige-gold text-black text-sm font-medium hover:bg-prestige-gold/90 transition-colors"
            onClick={saveRiskParams}
          >
            Save Risk Parameters
          </button>
        </section>
      )}
    </div>
  );
}
