import {
  cameraMode,
  projectPermissions,
  trajectoryCameraPose,
} from "@camera-path/contracts/host-data";
import { setCameraMode } from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "camera-view",
  scope: "project",
  reads: [trajectoryCameraPose, projectPermissions, cameraMode],
  calls: [setCameraMode],
  frames: [
    {
      id: "camera-view.update",
      phase: "update",
      after: ["host.trajectoryCamera.update"],
    },
  ],
  contributions: [
    { id: "camera-view.scene", kind: "scene", slot: "scene.root" },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"camera-view">;
