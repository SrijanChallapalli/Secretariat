/**
 * Distinct colors per biometric subsystem for easy visual identification.
 * Used in 3D markers and subsystem cards.
 */

import type { BiometricSubsystemId } from "../../../shared/types";

export const SUBSYSTEM_COLORS: Record<BiometricSubsystemId, string> = {
  heart: "#ef4444",      // red - cardiac
  lungs: "#3b82f6",      // blue - respiratory
  skeletal: "#a78bfa",   // violet - skeletal
  musculature: "#f97316", // orange - musculature
  joints: "#22c55e",     // green - joints
};

/** Lighter/transparent variants for backgrounds */
export const SUBSYSTEM_BG: Record<BiometricSubsystemId, string> = {
  heart: "bg-red-500/15 border-red-500/40",
  lungs: "bg-blue-500/15 border-blue-500/40",
  skeletal: "bg-violet-500/15 border-violet-500/40",
  musculature: "bg-orange-500/15 border-orange-500/40",
  joints: "bg-emerald-500/15 border-emerald-500/40",
};

/** Text color classes */
export const SUBSYSTEM_TEXT: Record<BiometricSubsystemId, string> = {
  heart: "text-red-400",
  lungs: "text-blue-400",
  skeletal: "text-violet-400",
  musculature: "text-orange-400",
  joints: "text-emerald-400",
};
