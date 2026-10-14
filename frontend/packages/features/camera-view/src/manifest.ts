import { cameraModeOutput } from "@camera-path/contracts/feature-data";
import { camera_view_setCameraMode } from "@camera-path/contracts/feature-requests";
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
  data: {
    provides: [cameraModeOutput],
    reads: [
      { contract: trajectoryCameraPose, access: ["read"] },
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: cameraMode, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: { calls: [setCameraMode], handles: [camera_view_setCameraMode] },
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
