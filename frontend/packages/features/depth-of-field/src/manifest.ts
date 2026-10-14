import {
  depth_of_field_addDepthOfFieldKeyframe,
  depth_of_field_deleteDepthOfFieldKeyframe,
} from "@camera-path/contracts/feature-requests";
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
  data: {
    provides: [],
    reads: [
      { contract: trajectoryCameraPose, access: ["read"] },
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      {
        contract: depthOfFieldTimeline,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: scenePoints, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: {
    calls: [addDepthOfFieldKeyframe, deleteDepthOfFieldKeyframe],
    handles: [
      depth_of_field_addDepthOfFieldKeyframe,
      depth_of_field_deleteDepthOfFieldKeyframe,
    ],
  },
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
