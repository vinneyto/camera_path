import {
  compiledTrajectory,
  sceneInteraction,
  playbackState,
} from "@camera-path/contracts/host-data";
import {
  selectObject,
  resetPlayback,
  seekPlayback,
  setPlaybackFrame,
  setPlaying,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "playback",
  scope: "project",
  reads: [compiledTrajectory, sceneInteraction, playbackState],
  calls: [
    seekPlayback,
    selectObject,
    setPlaybackFrame,
    resetPlayback,
    setPlaying,
  ],
  frames: [],
  contributions: [
    { id: "playback.runtime", kind: "ui", slot: "project.root" },
    { id: "playback.controls", kind: "ui", slot: "timeline.controls" },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"playback">;
