import { camera_aim_deleteCameraKeyframe } from "@camera-path/contracts/feature-requests";
import {
  aimTimeline,
  projectPermissions,
  scenePoints,
} from "@camera-path/contracts/host-data";
import { deleteCameraKeyframe } from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "camera-aim",
  scope: "project",
  data: {
    provides: [],
    reads: [
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: aimTimeline, access: ["read", "readAsync", "subscribe"] },
      { contract: scenePoints, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: {
    calls: [deleteCameraKeyframe],
    handles: [camera_aim_deleteCameraKeyframe],
  },
  frames: [],
  contributions: [
    {
      id: "camera-aim.track",
      kind: "timeline",
      slot: "timeline.tracks",
      resourceType: "camera-aim",
      order: 60,
    },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"camera-aim">;
