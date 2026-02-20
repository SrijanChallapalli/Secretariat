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
      <div className="w-full h-[28rem] rounded-lg bg-white/5 animate-pulse" />
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
    <div className="flex flex-col gap-4">
      {!canvasLoaded && (
        <div className="w-full h-[28rem] rounded-lg bg-white/5 animate-pulse" />
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
