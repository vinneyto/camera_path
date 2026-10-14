import { playbackOutput } from "@camera-path/contracts/feature-data";
import {
  playback_resetPlayback,
  playback_setPlaybackFrame,
  playback_setPlaying,
} from "@camera-path/contracts/feature-requests";
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
  data: {
    provides: [playbackOutput],
    reads: [
      { contract: playbackState, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: {
    calls: [setPlaybackFrame, resetPlayback, setPlaying],
    handles: [
      playback_setPlaybackFrame,
      playback_resetPlayback,
      playback_setPlaying,
    ],
  },
  frames: [],
  contributions: [],
  capabilities: [],
} as const satisfies FeatureManifest<"playback">;
