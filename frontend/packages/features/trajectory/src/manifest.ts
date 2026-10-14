import { trajectorySelectionOutput } from "@camera-path/contracts/feature-data";
import {
  trajectory_clearHoveredTrajectory,
  trajectory_clearTrajectory,
  trajectory_closeTrajectory,
  trajectory_hoverTrajectory,
  trajectory_selectTrajectory,
} from "@camera-path/contracts/feature-requests";
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
  data: {
    provides: [trajectorySelectionOutput],
    reads: [
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      {
        contract: trajectoryGeometry,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: editorTool, access: ["read", "readAsync", "subscribe"] },
      {
        contract: trajectorySelection,
        access: ["read", "readAsync", "subscribe"],
      },
    ],
  },
  requests: {
    calls: [
      clearTrajectory,
      hoverTrajectory,
      clearHoveredTrajectory,
      selectTrajectory,
      closeTrajectory,
    ],
    handles: [
      trajectory_clearTrajectory,
      trajectory_hoverTrajectory,
      trajectory_clearHoveredTrajectory,
      trajectory_selectTrajectory,
      trajectory_closeTrajectory,
    ],
  },
  frames: [],
  contributions: [
    { id: "trajectory.scene", kind: "scene", slot: "scene.root", order: 40 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"trajectory">;
