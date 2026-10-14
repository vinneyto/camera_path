"use client";
import type { PlaybackTrajectory } from "@camera-path/contracts/timeline-views";

import {
  createPlaybackTable,
  timeAtPathPosition,
} from "@camera-path/trajectory-math";

import { playbackState } from "@camera-path/contracts/host-data";
import {
  resetPlayback,
  setPlaybackFrame,
  setPlaying,
} from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";

export function useTrajectoryPlayback(trajectory: PlaybackTrajectory | null) {
  const table = trajectory ? createPlaybackTable(trajectory) : [];
  const duration = table.at(-1)?.time ?? 0;
  const { elapsed, pathPosition, playing } = useData(manifest, playbackState);
  const reset = useRequestAction(manifest, resetPlayback);
  const frame = useRequestAction(manifest, setPlaybackFrame);
  const play = useRequestAction(manifest, setPlaying);

  function seek(position: number) {
    const clamped = Math.min(1, Math.max(0, position));
    void frame({
      pathPosition: clamped,
      elapsed: timeAtPathPosition(table, clamped),
    });
  }

  function toggle() {
    if (pathPosition >= 1) {
      void frame({ pathPosition: 0, elapsed: 0 });
    }
    void play(!playing);
  }

  return {
    duration,
    elapsed,
    pathPosition,
    playing,
    reset: () => void reset(undefined),
    seek,
    toggle,
  };
}
