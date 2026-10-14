import {
  camera_orientation_addCameraOrientationKeyframe,
  camera_orientation_deleteCameraOrientationKeyframe,
  camera_orientation_updateCameraOrientationKeyframe,
  camera_orientation_updateDefaultCameraOrientation,
} from "@camera-path/contracts/feature-requests";
import {
  orientationTimeline,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import {
  addCameraOrientationKeyframe,
  deleteCameraOrientationKeyframe,
  updateCameraOrientationKeyframe,
  updateDefaultCameraOrientation,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "camera-orientation",
  scope: "project",
  data: {
    provides: [],
    reads: [
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      {
        contract: orientationTimeline,
        access: ["read", "readAsync", "subscribe"],
      },
    ],
  },
  requests: {
    calls: [
      addCameraOrientationKeyframe,
      updateCameraOrientationKeyframe,
      updateDefaultCameraOrientation,
      deleteCameraOrientationKeyframe,
    ],
    handles: [
      camera_orientation_addCameraOrientationKeyframe,
      camera_orientation_updateCameraOrientationKeyframe,
      camera_orientation_updateDefaultCameraOrientation,
      camera_orientation_deleteCameraOrientationKeyframe,
    ],
  },
  frames: [],
  contributions: [
    {
      id: "camera-orientation.track",
      kind: "timeline",
      slot: "timeline.tracks",
      resourceType: "camera-orientation",
      order: 70,
    },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"camera-orientation">;
