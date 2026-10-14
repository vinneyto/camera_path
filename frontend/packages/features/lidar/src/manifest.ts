import { lidarStatus } from "@camera-path/contracts/feature-data";
import { lidar_setLidarTimeline } from "@camera-path/contracts/feature-requests";
import {
  gaussianScene,
  lidarHitInstances,
  lidarRanges,
} from "@camera-path/contracts/gpu-resources";
import {
  lidarTimeline,
  projectPermissions,
  trajectoryCameraPose,
} from "@camera-path/contracts/host-data";
import { setLidarTimeline } from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "lidar",
  scope: "project",
  data: {
    provides: [lidarStatus],
    reads: [
      { contract: trajectoryCameraPose, access: ["read"] },
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: lidarTimeline, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: { calls: [setLidarTimeline], handles: [lidar_setLidarTimeline] },
  frames: [
    { id: "lidar.outputs", phase: "after-render" },
    {
      id: "lidar.update",
      phase: "update",
      after: ["host.trajectoryCamera.update"],
    },
  ],
  contributions: [
    {
      id: "lidar.sensor",
      kind: "gpu-pass",
      inputs: [gaussianScene],
      outputs: [lidarRanges, lidarHitInstances],
      after: ["host.gaussians.prepare"],
      before: ["host.scene.transparent"],
    },
    { id: "lidar.scene", kind: "scene", slot: "scene.root", order: 0 },
    {
      id: "lidar.track",
      kind: "timeline",
      slot: "timeline.tracks",
      resourceType: "lidar",
      order: 90,
    },
  ],
  capabilities: ["gpu.resources.allocate", "render.passes.register"],
} as const satisfies FeatureManifest<"lidar">;
