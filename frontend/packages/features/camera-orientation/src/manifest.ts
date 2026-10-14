import {
  compiledTrajectory,
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
  reads: [compiledTrajectory, projectPermissions, orientationTimeline],
  calls: [
    addCameraOrientationKeyframe,
    updateCameraOrientationKeyframe,
    updateDefaultCameraOrientation,
    deleteCameraOrientationKeyframe,
  ],
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
