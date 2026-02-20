/**
 * Biometric marker positions on the 3D horse model (Mesh_Horse.obj).
 * Anatomically calibrated and spread to avoid clumping.
 * OBJ scaled 0.024, positioned at [-0.35, -0.7, -0.55].
 * World space: Y=up, head high; Z=forward/back; X=left/right.
 */

import type { BiometricSubsystemId } from "../../../shared/types";

export const MARKER_POSITIONS: Record<BiometricSubsystemId, [number, number, number]> = {
  heart: [0.35, 0.6, 0.32],       // chest - front right
  lungs: [-0.45, 0.52, -0.08],     // barrel - left side, mid
  skeletal: [0, 0.98, 0.48],       // poll - top of head
  musculature: [-0.5, 0.46, -0.78], // hindquarter - deep in back left
  joints: [0.42, 0.02, 0.42],      // front fetlock - low front right
};
