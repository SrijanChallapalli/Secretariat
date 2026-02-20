/**
 * Camera position and target presets for the biometric 3D horse viewer.
 * All positions are in world units for a standing horse centered at origin.
 */

export interface CameraPreset {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

/** Model center for camera targeting (horse body center) */
const CENTER: [number, number, number] = [0, 0.5, 0.05];

/** Camera distance - zoomed out for clearer view */
const DIST = 4;

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "left",
    label: "Left",
    position: [DIST, 0.5, 0],
    target: CENTER,
  },
  {
    id: "right",
    label: "Right",
    position: [-DIST, 0.5, 0],
    target: CENTER,
  },
  {
    id: "front",
    label: "Front",
    position: [0, 0.5, DIST],
    target: CENTER,
  },
  {
    id: "back",
    label: "Back",
    position: [0, 0.5, -DIST],
    target: CENTER,
  },
  {
    id: "top",
    label: "Top",
    position: [0, DIST, 0.05],
    target: CENTER,
  },
  {
    id: "side",
    label: "Side",
    position: [3.5, 0.5, 2.8],
    target: CENTER,
  },
];
