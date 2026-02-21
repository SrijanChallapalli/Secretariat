"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { BiometricScanResult, BiometricSubsystemId } from "../../../shared/types";

const BiometricModelCanvas = dynamic(
  () =>
    import("./BiometricModelCanvas").then((m) => ({ default: m.BiometricModelCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-h-[260px] flex-1 bg-card animate-pulse" />
    ),
  },
);

interface BiometricModelViewerProps {
  scan: BiometricScanResult;
  tokenId: number;
  selectedMarker?: BiometricSubsystemId | null;
  onMarkerSelect?: (id: BiometricSubsystemId | null) => void;
  onMarkerScroll?: (subsystemId: BiometricSubsystemId) => void;
}

export function BiometricModelViewer({
  scan,
  tokenId,
  selectedMarker = null,
  onMarkerSelect,
  onMarkerScroll,
}: BiometricModelViewerProps) {
  const [canvasLoaded, setCanvasLoaded] = useState(false);

  const handleMarkerSelect = useCallback(
    (id: BiometricSubsystemId | null) => {
      onMarkerSelect?.(id);
      if (id) onMarkerScroll?.(id);
    },
    [onMarkerSelect, onMarkerScroll],
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full relative">
      {!canvasLoaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse z-10" />
      )}
      <BiometricModelCanvas
        scan={scan}
        wireframe={true}
        selectedMarker={selectedMarker ?? null}
        onMarkerSelect={handleMarkerSelect}
        cameraPreset="side"
        onLoaded={() => setCanvasLoaded(true)}
      />
    </div>
  );
}
