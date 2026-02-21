"use client";

import { useState } from "react";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

type EventType = "RACE_RESULT" | "INJURY" | "NEWS";

interface CascadeResult {
  offspringTokenId: number;
  multiplier: number;
  reason: string;
  previousValuationADI: string;
  newValuationADI: string;
  txHash: string;
}

interface PipelineResult {
  eventHash: string;
  newValuationADI: string;
  previousValuationADI: string;
  verifiedValuationADI: string | null;
  txStatus: "success" | "reverted" | "pending";
  multiplier: number;
  valuationResult: {
    value: number;
    confidence: number;
    breakdown?: Record<string, number>;
    explanation?: string;
  };
  txHash: string;
  ogRootHash: string | null;
  ogTxHash: string | null;
  canonicalJson: string;
  submittedAt: string;
  cascadingOffspring?: CascadeResult[];
}

export default function AdminPage() {
  const [horseId, setHorseId] = useState("0");

  // --- Pipeline state ---
  const [pipeType, setPipeType] = useState<EventType>("RACE_RESULT");
  const [pipeFinish, setPipeFinish] = useState("1");
  const [pipeEarnings, setPipeEarnings] = useState("100");
  const [pipeTrack, setPipeTrack] = useState("");
  const [pipeRaceClass, setPipeRaceClass] = useState("");
  const [pipeOdds, setPipeOdds] = useState("");
  const [pipeSeverity, setPipeSeverity] = useState("500");
  const [pipeInjuryType, setPipeInjuryType] = useState("");
  const [pipeDaysOut, setPipeDaysOut] = useState("");
  const [pipeSentiment, setPipeSentiment] = useState("200");
  const [pipeHeadline, setPipeHeadline] = useState("");
  const [uploadTo0g, setUploadTo0g] = useState(false);
  const [pipeLoading, setPipeLoading] = useState(false);
  const [pipeError, setPipeError] = useState<string | null>(null);
  const [pipeResult, setPipeResult] = useState<PipelineResult | null>(null);
  const [showCanonical, setShowCanonical] = useState(false);

  async function runPipeline() {
    setPipeLoading(true);
    setPipeError(null);
    setPipeResult(null);

    try {
      // Build params for simulation
      let params: Record<string, unknown> = {};
      if (pipeType === "RACE_RESULT") {
        params = {
          finishPosition: Number(pipeFinish),
          earningsADI: pipeEarnings,
          ...(pipeTrack && { track: pipeTrack }),
          ...(pipeRaceClass && { raceClass: pipeRaceClass }),
          ...(pipeOdds && { odds: Number(pipeOdds) }),
        };
      } else if (pipeType === "INJURY") {
        params = {
          severityBps: Number(pipeSeverity),
          ...(pipeInjuryType && { injuryType: pipeInjuryType }),
          ...(pipeDaysOut && { expectedDaysOut: Number(pipeDaysOut) }),
        };
      } else {
        params = {
          sentimentBps: Number(pipeSentiment),
          ...(pipeHeadline && { headline: pipeHeadline }),
        };
      }

      // Step 1: Simulate
      const simRes = await fetch(`${SERVER_URL}/events/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: Number(horseId),
          type: pipeType,
          params,
        }),
      });
      if (!simRes.ok) {
        const err = await simRes.json().catch(() => ({ error: simRes.statusText }));
        throw new Error(err.error || "Simulate failed");
      }
      const simData = await simRes.json();

      // Step 2: Apply event
      const applyRes = await fetch(`${SERVER_URL}/oracle/apply-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: simData.event,
          uploadTo0g,
        }),
      });
      if (!applyRes.ok) {
        const err = await applyRes.json().catch(() => ({ error: applyRes.statusText }));
        throw new Error(err.error || "Apply event failed");
      }
      const result: PipelineResult = await applyRes.json();
      setPipeResult(result);
    } catch (e) {
      setPipeError((e as Error).message);
    } finally {
      setPipeLoading(false);
    }
  }

  function formatADI(weiStr: string): string {
    try {
      const n = BigInt(weiStr);
      const whole = n / BigInt(1e18);
      return `${whole.toLocaleString()} ADI`;
    } catch {
      return weiStr;
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-sm bg-secondary border border-border text-sm";
  const labelCls = "block text-xs text-muted-foreground";

  return (
    <div className="space-y-8 max-w-lg">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide text-foreground">
          Oracle / Admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Role: ORACLE_ROLE. Simulate race result, injury, news for valuation
          updates.
        </p>
      </header>

      {/* Shared token ID */}
      <div className="space-y-1">
        <label className={labelCls}>Horse token ID</label>
        <input
          type="number"
          className={inputCls}
          value={horseId}
          onChange={(e) => setHorseId(e.target.value)}
        />
      </div>

      {/* Simulate + Revalue (Agent) */}
      <section className="space-y-4 border border-primary/40 rounded-md p-4">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
          Simulate + Revalue (Agent)
        </h2>
        <p className="text-xs text-muted-foreground">
          Builds a canonical event, runs the valuation engine on the server, and
          commits the result on-chain via commitValuation.
        </p>

        {/* Event type selector */}
        <div className="space-y-1">
          <label className={labelCls}>Event type</label>
          <select
            className={inputCls}
            value={pipeType}
            onChange={(e) => setPipeType(e.target.value as EventType)}
          >
            <option value="RACE_RESULT">Race Result</option>
            <option value="INJURY">Injury</option>
            <option value="NEWS">News</option>
          </select>
        </div>

        {/* Dynamic params */}
        {pipeType === "RACE_RESULT" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className={labelCls}>Finish position</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={pipeFinish}
                onChange={(e) => setPipeFinish(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Earnings ADI</label>
              <input
                type="text"
                className={inputCls}
                value={pipeEarnings}
                onChange={(e) => setPipeEarnings(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className={labelCls}>Track</label>
                <input
                  type="text"
                  className={inputCls}
                  value={pipeTrack}
                  onChange={(e) => setPipeTrack(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Race class</label>
                <input
                  type="text"
                  className={inputCls}
                  value={pipeRaceClass}
                  onChange={(e) => setPipeRaceClass(e.target.value)}
                  placeholder="Grade 1"
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Odds</label>
                <input
                  type="text"
                  className={inputCls}
                  value={pipeOdds}
                  onChange={(e) => setPipeOdds(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
          </div>
        )}

        {pipeType === "INJURY" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className={labelCls}>Severity (bps 0-10000)</label>
              <input
                type="number"
                className={inputCls}
                value={pipeSeverity}
                onChange={(e) => setPipeSeverity(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={labelCls}>Injury type</label>
                <input
                  type="text"
                  className={inputCls}
                  value={pipeInjuryType}
                  onChange={(e) => setPipeInjuryType(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Days out</label>
                <input
                  type="number"
                  className={inputCls}
                  value={pipeDaysOut}
                  onChange={(e) => setPipeDaysOut(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
          </div>
        )}

        {pipeType === "NEWS" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className={labelCls}>Sentiment (bps 0-5000)</label>
              <input
                type="number"
                className={inputCls}
                value={pipeSentiment}
                onChange={(e) => setPipeSentiment(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Headline</label>
              <input
                type="text"
                className={inputCls}
                value={pipeHeadline}
                onChange={(e) => setPipeHeadline(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
        )}

        {/* 0G toggle */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={uploadTo0g}
            onChange={(e) => setUploadTo0g(e.target.checked)}
            className="rounded border-border"
          />
          Upload event bundle to 0G Storage
        </label>

        {/* Submit */}
        <button
          className="w-full px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          onClick={runPipeline}
          disabled={pipeLoading}
        >
          {pipeLoading ? "Processing..." : "Simulate + Revalue (Agent)"}
        </button>

        {/* Error */}
        {pipeError && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-sm p-3">
            {pipeError}
          </div>
        )}

        {/* Results */}
        {pipeResult && (
          <div className="space-y-3 text-sm">
            <h3 className="font-semibold text-foreground">Pipeline Result</h3>

            {/* Tx status banner */}
            {pipeResult.txStatus === "reverted" && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-sm p-2">
                Transaction REVERTED on-chain. The valuation was NOT updated. Check that ORACLE_ROLE is granted and horseOracle is set on HorseINFT.
              </div>
            )}
            {pipeResult.txStatus === "success" && (
              <div className="text-xs text-terminal-green bg-terminal-green/10 border border-terminal-green/30 rounded-sm p-2">
                Transaction confirmed on-chain.
              </div>
            )}

            {/* Valuation change summary */}
            <div className="rounded-sm border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground mb-1">Valuation Change</p>
              <p className="text-base font-semibold">
                {formatADI(pipeResult.previousValuationADI)}
                <span className="text-muted-foreground mx-2">&rarr;</span>
                <span className="text-primary">{formatADI(pipeResult.newValuationADI)}</span>
                <span className="text-xs text-muted-foreground ml-2">({pipeResult.multiplier.toFixed(4)}x)</span>
              </p>
              {pipeResult.verifiedValuationADI && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Verified on-chain: {formatADI(pipeResult.verifiedValuationADI)}
                  {pipeResult.verifiedValuationADI === pipeResult.newValuationADI
                    ? " (matches)"
                    : " (MISMATCH)"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Event Hash</span>
              <span className="font-mono truncate" title={pipeResult.eventHash}>
                {pipeResult.eventHash.slice(0, 18)}...
              </span>

              <span className="text-muted-foreground">Confidence</span>
              <span>{(pipeResult.valuationResult.confidence * 100).toFixed(0)}%</span>

              <span className="text-muted-foreground">Tx Hash</span>
              <span className="font-mono truncate" title={pipeResult.txHash}>
                {pipeResult.txHash.slice(0, 18)}...
              </span>

              <span className="text-muted-foreground">Tx Status</span>
              <span className={pipeResult.txStatus === "success" ? "text-terminal-green" : pipeResult.txStatus === "reverted" ? "text-destructive" : "text-muted-foreground"}>
                {pipeResult.txStatus}
              </span>

              {pipeResult.ogRootHash && (
                <>
                  <span className="text-muted-foreground">0G Root Hash</span>
                  <a
                    href={`${SERVER_URL}/og/download/${pipeResult.ogRootHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline font-mono truncate"
                    title={pipeResult.ogRootHash}
                  >
                    {pipeResult.ogRootHash.slice(0, 18)}...
                  </a>
                </>
              )}
            </div>

            {/* Cascading offspring */}
            {pipeResult.cascadingOffspring && pipeResult.cascadingOffspring.length > 0 && (
              <div className="rounded-sm border border-prestige-gold/30 bg-prestige-gold/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-prestige-gold uppercase tracking-wider">
                  Cascading Offspring Updates ({pipeResult.cascadingOffspring.length})
                </p>
                {pipeResult.cascadingOffspring.map((c) => (
                  <div key={c.offspringTokenId} className="text-xs grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <span className="text-muted-foreground">Token #{c.offspringTokenId}</span>
                    <span>{formatADI(c.previousValuationADI)} &rarr; {formatADI(c.newValuationADI)} ({c.multiplier.toFixed(4)}x)</span>
                    <span className="text-muted-foreground">Reason</span>
                    <span>{c.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Explanation */}
            {pipeResult.valuationResult.explanation && (
              <p className="text-xs text-muted-foreground italic">
                {typeof pipeResult.valuationResult.explanation === "string"
                  ? pipeResult.valuationResult.explanation
                  : (pipeResult.valuationResult.explanation as any)?.summary}
              </p>
            )}

            {/* Breakdown */}
            {pipeResult.valuationResult.breakdown && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Valuation breakdown
                </summary>
                <pre className="mt-1 p-2 bg-secondary rounded-sm overflow-auto max-h-40 text-[10px]">
                  {JSON.stringify(pipeResult.valuationResult.breakdown, null, 2)}
                </pre>
              </details>
            )}

            {/* Canonical JSON */}
            <div>
              <button
                onClick={() => setShowCanonical(!showCanonical)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                {showCanonical ? "Hide" : "Show"} canonical JSON
              </button>
              {showCanonical && (
                <textarea
                  readOnly
                  className="mt-1 w-full h-32 p-2 bg-secondary border border-border rounded-sm text-[10px] font-mono resize-y"
                  value={pipeResult.canonicalJson}
                />
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
