import {
  compiledTrajectory,
  cameraMode,
  playbackState,
  editorTool,
  projectPermissions,
  trajectoryGeometry,
  sceneInteraction,
} from "@camera-path/contracts/host-data";
import {
  seekPlayback,
  hoverObject,
  clearTrajectory,
  selectObject,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "trajectory",
  scope: "project",
  reads: [
    compiledTrajectory,
    cameraMode,
    playbackState,
    projectPermissions,
    trajectoryGeometry,
    editorTool,
    sceneInteraction,
  ],
  calls: [seekPlayback, clearTrajectory, hoverObject, selectObject],
  frames: [],
  contributions: [
    { id: "trajectory.status", kind: "ui", slot: "project.header.status" },
    { id: "trajectory.overlay", kind: "ui", slot: "scene.overlay" },
    { id: "trajectory.scene", kind: "scene", slot: "scene.root", order: 40 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"trajectory">;
