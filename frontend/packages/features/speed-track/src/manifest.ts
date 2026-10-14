import {
  compiledTrajectory,
  playbackState,
  projectPermissions,
  speedTimeline,
} from "@camera-path/contracts/host-data";
import { deleteSpeedKeyframe } from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "speed-track",
  scope: "project",
  reads: [compiledTrajectory, playbackState, projectPermissions, speedTimeline],
  calls: [deleteSpeedKeyframe],
  frames: [],
  contributions: [
    {
      id: "speed-track.track",
      kind: "timeline",
      slot: "timeline.tracks",
      resourceType: "speed-track",
      order: 50,
    },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"speed-track">;
