"use client";

import { useEffect, useState } from "react";
import { fetchBiometricScan } from "@/lib/biometric";
import type { BiometricScanResult, BiometricSubsystem, BiometricSubsystemId } from "../../../shared/types.js";

interface BiometricScanSectionProps {
  tokenId: number;
}

type HighlightRegion =
  | "chest"
  | "ribcage"
  | "spine"
  | "shoulder"
  | "hindquarters"
  | "fetlocks"
  | "hocks"
  | "knees";

function getLabelColor(label: string): string {
  switch (label) {
    case "EXCEPTIONAL":
      return "border-terminal-green text-terminal-green";
    case "STRONG":
      return "border-terminal-green/60 text-terminal-green/80";
    case "AVERAGE":
      return "border-terminal-amber text-terminal-amber";
    case "RISK":
      return "border-terminal-red text-terminal-red";
    default:
      return "border-muted-foreground text-muted-foreground";
  }
}

function HorseSilhouette({
  activeRegions,
}: {
  activeRegions: HighlightRegion[];
}) {
  const isActive = (region: HighlightRegion) => activeRegions.includes(region);

  return (
    <svg
      viewBox="0 0 200 300"
      className="w-full h-full max-w-sm mx-auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Simple horse silhouette wireframe */}
      {/* Head */}
      <ellipse
        cx="100"
        cy="40"
        rx="25"
        ry="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />

      {/* Neck */}
      <line
        x1="100"
        y1="70"
        x2="100"
        y2="100"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />

      {/* Chest region */}
      <ellipse
        cx="100"
        cy="110"
        rx="35"
        ry="25"
        fill={isActive("chest") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("chest") ? "3" : "1"}
        className={
          isActive("chest")
            ? "text-terminal-cyan/30 stroke-terminal-cyan"
            : "text-muted-foreground/20"
        }
        opacity={isActive("chest") ? 0.4 : 0.1}
      />

      {/* Ribcage region */}
      <ellipse
        cx="100"
        cy="140"
        rx="40"
        ry="30"
        fill={isActive("ribcage") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("ribcage") ? "3" : "1"}
        className={
          isActive("ribcage")
            ? "text-terminal-cyan/30 stroke-terminal-cyan"
            : "text-muted-foreground/20"
        }
        opacity={isActive("ribcage") ? 0.4 : 0.1}
      />

      {/* Spine */}
      <line
        x1="100"
        y1="100"
        x2="100"
        y2="200"
        stroke={isActive("spine") ? "currentColor" : "currentColor"}
        strokeWidth={isActive("spine") ? "3" : "2"}
        className={
          isActive("spine")
            ? "text-terminal-cyan stroke-terminal-cyan"
            : "text-muted-foreground"
        }
      />

      {/* Shoulder region */}
      <ellipse
        cx="85"
        cy="120"
        rx="15"
        ry="20"
        fill={isActive("shoulder") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("shoulder") ? "3" : "1"}
        className={
          isActive("shoulder")
            ? "text-terminal-cyan/30 stroke-terminal-cyan"
            : "text-muted-foreground/20"
        }
        opacity={isActive("shoulder") ? 0.4 : 0.1}
      />
      <ellipse
        cx="115"
        cy="120"
        rx="15"
        ry="20"
        fill={isActive("shoulder") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("shoulder") ? "3" : "1"}
        className={
          isActive("shoulder")
            ? "text-terminal-cyan/30 stroke-terminal-cyan"
            : "text-muted-foreground/20"
        }
        opacity={isActive("shoulder") ? 0.4 : 0.1}
      />

      {/* Body outline */}
      <ellipse
        cx="100"
        cy="160"
        rx="45"
        ry="35"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />

      {/* Hindquarters region */}
      <ellipse
        cx="100"
        cy="190"
        rx="35"
        ry="30"
        fill={isActive("hindquarters") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("hindquarters") ? "3" : "1"}
        className={
          isActive("hindquarters")
            ? "text-terminal-cyan/30 stroke-terminal-cyan"
            : "text-muted-foreground/20"
        }
        opacity={isActive("hindquarters") ? 0.4 : 0.1}
      />

      {/* Front legs */}
      <line
        x1="85"
        y1="195"
        x2="85"
        y2="260"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />
      <line
        x1="115"
        y1="195"
        x2="115"
        y2="260"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />

      {/* Knees */}
      <circle
        cx="85"
        cy="230"
        r="8"
        fill={isActive("knees") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("knees") ? "3" : "2"}
        className={
          isActive("knees")
            ? "text-terminal-cyan stroke-terminal-cyan"
            : "text-muted-foreground"
        }
        opacity={isActive("knees") ? 0.6 : 0.3}
      />
      <circle
        cx="115"
        cy="230"
        r="8"
        fill={isActive("knees") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("knees") ? "3" : "2"}
        className={
          isActive("knees")
            ? "text-terminal-cyan stroke-terminal-cyan"
            : "text-muted-foreground"
        }
        opacity={isActive("knees") ? 0.6 : 0.3}
      />

      {/* Hocks */}
      <circle
        cx="85"
        cy="250"
        r="6"
        fill={isActive("hocks") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("hocks") ? "3" : "2"}
        className={
          isActive("hocks")
            ? "text-terminal-cyan stroke-terminal-cyan"
            : "text-muted-foreground"
        }
        opacity={isActive("hocks") ? 0.6 : 0.3}
      />
      <circle
        cx="115"
        cy="250"
        r="6"
        fill={isActive("hocks") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("hocks") ? "3" : "2"}
        className={
          isActive("hocks")
            ? "text-terminal-cyan stroke-terminal-cyan"
            : "text-muted-foreground"
        }
        opacity={isActive("hocks") ? 0.6 : 0.3}
      />

      {/* Fetlocks */}
      <circle
        cx="85"
        cy="270"
        r="5"
        fill={isActive("fetlocks") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("fetlocks") ? "3" : "2"}
        className={
          isActive("fetlocks")
            ? "text-terminal-cyan stroke-terminal-cyan"
            : "text-muted-foreground"
        }
        opacity={isActive("fetlocks") ? 0.6 : 0.3}
      />
      <circle
        cx="115"
        cy="270"
        r="5"
        fill={isActive("fetlocks") ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isActive("fetlocks") ? "3" : "2"}
        className={
          isActive("fetlocks")
            ? "text-terminal-cyan stroke-terminal-cyan"
            : "text-muted-foreground"
        }
        opacity={isActive("fetlocks") ? 0.6 : 0.3}
      />

      {/* Hooves */}
      <ellipse
        cx="85"
        cy="285"
        rx="6"
        ry="8"
        fill="currentColor"
        className="text-muted-foreground"
      />
      <ellipse
        cx="115"
        cy="285"
        rx="6"
        ry="8"
        fill="currentColor"
        className="text-muted-foreground"
      />

      {/* Hind legs */}
      <line
        x1="75"
        y1="220"
        x2="75"
        y2="280"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />
      <line
        x1="125"
        y1="220"
        x2="125"
        y2="280"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />
    </svg>
  );
}

export function BiometricScanSection({ tokenId }: BiometricScanSectionProps) {
  const [scan, setScan] = useState<BiometricScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubsystem, setActiveSubsystem] =
    useState<BiometricSubsystemId | null>("heart");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchBiometricScan(tokenId)
      .then((result) => {
        if (!cancelled) {
          setScan(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load biometric scan");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  const activeSubsystemData = scan?.subsystems.find(
    (s) => s.id === activeSubsystem
  );
  const activeRegions: HighlightRegion[] =
    activeSubsystemData?.highlights || [];

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-terminal-cyan animate-pulse" />
            <h3 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              BIOMETRIC SCAN
            </h3>
          </div>
        </div>
        <div className="text-sm text-muted-foreground text-center py-8">
          Scanning...
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-terminal-red" />
            <h3 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              BIOMETRIC SCAN
            </h3>
          </div>
        </div>
        <div className="text-sm text-muted-foreground text-center py-4">
          {error || "Failed to load scan"}
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchBiometricScan(tokenId)
                .then(setScan)
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
            }}
            className="ml-2 text-terminal-cyan hover:underline text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-terminal-cyan" />
          <h3 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            BIOMETRIC SCAN
          </h3>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          DRAG TO ROTATE
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: SVG Visualization */}
        <div className="flex items-center justify-center min-h-[300px]">
          <HorseSilhouette activeRegions={activeRegions} />
        </div>

        {/* Right: Biological Factors */}
        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
            BIOLOGICAL FACTORS
          </h4>
          <div className="space-y-2">
            {scan.subsystems.map((subsystem) => (
              <button
                key={subsystem.id}
                onClick={() => setActiveSubsystem(subsystem.id)}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  activeSubsystem === subsystem.id
                    ? "border-terminal-cyan/50 bg-terminal-cyan/5"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono capitalize">
                    {subsystem.id}
                  </span>
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded border ${getLabelColor(
                      subsystem.label
                    )}`}
                  >
                    {subsystem.label}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {subsystem.reasons.slice(0, 2).join(" • ")}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
