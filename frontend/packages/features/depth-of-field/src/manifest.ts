import {
  depthOfFieldTimeline,
  projectPermissions,
  scenePoints,
  trajectoryCameraPose,
} from "@camera-path/contracts/host-data";
import {
  addDepthOfFieldKeyframe,
  deleteDepthOfFieldKeyframe,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "depth-of-field",
  scope: "project",
  reads: [
    trajectoryCameraPose,
    projectPermissions,
    depthOfFieldTimeline,
    scenePoints,
  ],
  calls: [addDepthOfFieldKeyframe, deleteDepthOfFieldKeyframe],
  frames: [
    {
      id: "depth-of-field.helper",
      phase: "update",
      after: ["host.trajectoryCamera.update"],
    },
  ],
  contributions: [
    { id: "depth-of-field.scene", kind: "scene", slot: "scene.root" },
    {
      id: "depth-of-field.track",
      kind: "timeline",
      slot: "timeline.tracks",
      resourceType: "depth-of-field",
      order: 80,
    },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"depth-of-field">;
