import { playbackState } from "@camera-path/contracts/host-data";
import {
  resetPlayback,
  setPlaybackFrame,
  setPlaying,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "playback",
  scope: "project",
  reads: [playbackState],
  calls: [setPlaybackFrame, resetPlayback, setPlaying],
  frames: [],
  contributions: [],
  capabilities: [],
} as const satisfies FeatureManifest<"playback">;
