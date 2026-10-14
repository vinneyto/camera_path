import {
  editorTool,
  projectPermissions,
  trajectoryGeometry,
  trajectorySelection,
} from "@camera-path/contracts/host-data";
import {
  clearHoveredTrajectory,
  clearTrajectory,
  closeTrajectory,
  hoverTrajectory,
  selectTrajectory,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "trajectory",
  scope: "project",
  reads: [
    projectPermissions,
    trajectoryGeometry,
    editorTool,
    trajectorySelection,
  ],
  calls: [
    clearTrajectory,
    hoverTrajectory,
    clearHoveredTrajectory,
    selectTrajectory,
    closeTrajectory,
  ],
  frames: [],
  contributions: [
    { id: "trajectory.scene", kind: "scene", slot: "scene.root", order: 40 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"trajectory">;
