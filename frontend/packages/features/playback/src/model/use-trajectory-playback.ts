"use client";
import { useEditorActions, useSeekPlayback } from "@camera-path/actions";
import { usePlaybackState } from "@camera-path/store";

import type { PlaybackTrajectory } from "@camera-path/types/timeline-views";

import { createPlaybackTable } from "@camera-path/trajectory-math";

export function useTrajectoryPlayback(trajectory: PlaybackTrajectory | null) {
  const table = trajectory ? createPlaybackTable(trajectory) : [];
  const duration = table.at(-1)?.time ?? 0;
  const { elapsed, pathPosition, playing } = usePlaybackState();
  const reset = useEditorActions().resetPlayback;
  const frame = useEditorActions().setPlaybackFrame;
  const seekAction = useSeekPlayback();
  const play = useEditorActions().setPlaying;

  function seek(position: number) {
    const clamped = Math.min(1, Math.max(0, position));
    void seekAction(clamped);
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
    reset: () => void reset(),
    seek,
    toggle,
  };
}
