import {
  editorTool,
  projectPermissions,
  trajectoryGeometry,
  sceneInteraction,
} from "@camera-path/contracts/host-data";
import {
  hoverObject,
  clearTrajectory,
  selectObject,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "trajectory",
  scope: "project",
  reads: [projectPermissions, trajectoryGeometry, editorTool, sceneInteraction],
  calls: [clearTrajectory, hoverObject, selectObject],
  frames: [],
  contributions: [
    { id: "trajectory.scene", kind: "scene", slot: "scene.root", order: 40 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"trajectory">;
