"use client";

import {
  createPlaybackTable,
  timeAtPathPosition,
  type CompiledTrajectory,
} from "@/entities/trajectory";

import { useEditorStore } from "./editor-store-provider";

export function useTrajectoryPlayback(trajectory: CompiledTrajectory | null) {
  const table = trajectory ? createPlaybackTable(trajectory) : [];
  const duration = table.at(-1)?.time ?? 0;
  const { elapsed, pathPosition, playing } = useEditorStore(
    (state) => state.playback,
  );
  const { resetPlayback, setPlaybackFrame, setPlaying } = useEditorStore(
    (state) => state.playbackActions,
  );

  function seek(position: number) {
    const clamped = Math.min(1, Math.max(0, position));
    setPlaybackFrame(clamped, timeAtPathPosition(table, clamped));
  }

  function toggle() {
    if (pathPosition >= 1) {
      setPlaybackFrame(0, 0);
    }
    setPlaying(!playing);
  }

  return {
    duration,
    elapsed,
    pathPosition,
    playing,
    reset: resetPlayback,
    seek,
    toggle,
  };
}
