"use client";

import { useCallback, useMemo } from "react";

import {
  createPlaybackTable,
  timeAtPathPosition,
  type CompiledTrajectory,
} from "@/entities/trajectory";

import { useEditorStore } from "./editor-store-provider";

export function useTrajectoryPlayback(trajectory: CompiledTrajectory | null) {
  const table = useMemo(() => trajectory ? createPlaybackTable(trajectory) : [], [trajectory]);
  const duration = table.at(-1)?.time ?? 0;
  const { elapsed, pathPosition, playing } = useEditorStore((state) => state.playback);
  const { setPlaybackFrame, setPlaying } = useEditorStore(
    (state) => state.playbackActions,
  );

  const seek = useCallback((position: number) => {
    const clamped = Math.min(1, Math.max(0, position));
    setPlaybackFrame(clamped, timeAtPathPosition(table, clamped));
  }, [setPlaybackFrame, table]);

  const toggle = useCallback(() => {
    if (pathPosition >= 1) {
      setPlaybackFrame(0, 0);
    }
    setPlaying(!playing);
  }, [pathPosition, playing, setPlaybackFrame, setPlaying]);

  return { duration, elapsed, pathPosition, playing, seek, toggle };
}
