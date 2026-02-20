"use client";

import { CAMERA_PRESETS } from "./cameraPresets";

interface BiometricThumbnailsProps {
  cameraPreset: string;
  onPresetSelect: (presetId: string) => void;
}

export function BiometricThumbnails({
  cameraPreset,
  onPresetSelect,
}: BiometricThumbnailsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto py-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {CAMERA_PRESETS.map((preset) => {
        const isActive = cameraPreset === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPresetSelect(preset.id)}
            className={`
              flex-shrink-0 w-16 h-12 rounded border transition-colors
              flex flex-col items-center justify-center gap-0.5
              ${
                isActive
                  ? "border-cyan-400/50 bg-cyan-500/20"
                  : "border-cyan-500/20 bg-cyan-950/30 hover:border-cyan-400/30 hover:bg-cyan-900/40"
              }
            `}
          >
            <span className="text-[10px] text-cyan-200/80 uppercase">
              {preset.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
