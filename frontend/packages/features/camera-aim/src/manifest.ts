import {
  compiledTrajectory,
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
  reads: [compiledTrajectory, projectPermissions, aimTimeline, scenePoints],
  calls: [deleteCameraKeyframe],
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
