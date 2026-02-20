"use client";

import { useEffect, useState, useRef } from "react";
import { fetchBiometricScan } from "@/lib/biometric";
import { BiometricModelViewer } from "@/components/biometric/BiometricModelViewer";
import type {
  BiometricScanResult,
  BiometricSubsystem,
  BiometricLabel,
  BiometricSubsystemId,
} from "../../../shared/types";
import {
  SUBSYSTEM_COLORS,
  SUBSYSTEM_BG,
  SUBSYSTEM_TEXT,
} from "@/components/biometric/subsystemColors";

interface BiometricScanSectionProps {
  tokenId: number;
}

const LABEL_COLORS: Record<BiometricLabel, string> = {
  EXCEPTIONAL: "text-emerald-400",
  STRONG: "text-sky-400",
  AVERAGE: "text-amber-400",
  RISK: "text-red-400",
};

const SUBSYSTEM_NAMES: Record<BiometricSubsystemId, string> = {
  heart: "Cardiac",
  lungs: "Respiratory",
  skeletal: "Skeletal",
  musculature: "Musculature",
  joints: "Joints",
};

function SubsystemCard({
  sub,
  innerRef,
  selected,
  onClick,
}: {
  sub: BiometricSubsystem;
  innerRef?: (el: HTMLDivElement | null) => void;
  selected?: boolean;
  onClick?: () => void;
}) {
  const subColor = SUBSYSTEM_COLORS[sub.id];
  return (
    <div
      ref={innerRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={`rounded-lg border p-3 cursor-pointer transition-all ${SUBSYSTEM_BG[sub.id]} ${
        selected ? "ring-2 ring-white/50 ring-offset-2 ring-offset-[#0c1222]" : "hover:border-white/30"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold tracking-wider uppercase ${SUBSYSTEM_TEXT[sub.id]}`}>
          {SUBSYSTEM_NAMES[sub.id]}
        </span>
        <span className={`text-sm font-bold ${SUBSYSTEM_TEXT[sub.id]}`}>
          {sub.score}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/10 mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${sub.score}%`,
            backgroundColor: subColor,
          }}
        />
      </div>
      <p className={`text-[10px] font-medium mb-1 ${LABEL_COLORS[sub.label]}`}>
        {sub.label}
      </p>
      <ul className="space-y-0.5">
        {sub.reasons.map((r, i) => (
          <li key={i} className="text-[11px] text-muted-foreground leading-tight">
            {r}
          </li>
        ))}
      </ul>
      {sub.flags?.length ? (
        <div className="mt-1.5 flex gap-1 flex-wrap">
          {sub.flags.map((f) => (
            <span
              key={f}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-prestige-gold"
            >
              {f}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BiometricScanSection({ tokenId }: BiometricScanSectionProps) {
  const [scan, setScan] = useState<BiometricScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<BiometricSubsystemId | null>(null);
  const subsystemCardsRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBiometricScan(tokenId)
      .then((result) => {
        if (!cancelled) setScan(result);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-5 animate-pulse">
        <div className="h-4 w-48 rounded bg-white/10 mb-4" />
        <div className="h-32 rounded bg-white/5" />
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-2">
          BIOMETRIC SCAN
        </h3>
        <p className="text-sm text-red-400">
          {error ?? "Unable to load biometric data"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase">
          BIOMETRIC SCAN
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground">
          {scan.engineVersion}
        </span>
      </div>

      {/* Overall score */}
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2.5"
            />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke={
                scan.overall.label === "EXCEPTIONAL"
                  ? "#34d399"
                  : scan.overall.label === "STRONG"
                    ? "#38bdf8"
                    : scan.overall.label === "AVERAGE"
                      ? "#fbbf24"
                      : "#f87171"
              }
              strokeWidth="2.5"
              strokeDasharray={`${scan.overall.score} ${100 - scan.overall.score}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
            {scan.overall.score}
          </span>
        </div>
        <div>
          <p className={`text-lg font-bold ${LABEL_COLORS[scan.overall.label]}`}>
            {scan.overall.label}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Confidence {Math.round(scan.overall.confidence * 100)}%
            &middot; Valuation modifier{" "}
            {scan.overall.valuationMultiplierBps > 0 ? "+" : ""}
            {(scan.overall.valuationMultiplierBps / 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* 3D viewer | subsystem cards */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <BiometricModelViewer
            scan={scan}
            tokenId={tokenId}
            selectedMarker={selectedMarker}
            onMarkerSelect={setSelectedMarker}
            onMarkerScroll={(subsystemId) => {
              const el = subsystemCardsRef.current[subsystemId];
              el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }}
          />
        </div>
        <div className="lg:w-72 flex-shrink-0 space-y-2">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
            Subsystems
          </p>
          {scan.subsystems.map((sub) => (
            <SubsystemCard
              key={sub.id}
              sub={sub}
              selected={selectedMarker === sub.id}
              onClick={() => setSelectedMarker(selectedMarker === sub.id ? null : sub.id)}
              innerRef={(el) => {
                subsystemCardsRef.current[sub.id] = el;
              }}
            />
          ))}
        </div>
      </div>

      {/* Notes */}
      {scan.notes?.length ? (
        <div className="space-y-1 pt-2 border-t border-white/5">
          {scan.notes.map((note, i) => (
            <p
              key={i}
              className="text-[11px] text-muted-foreground italic"
            >
              {note}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
