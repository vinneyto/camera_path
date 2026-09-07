"use client";

import { useCallback, useEffect, useMemo } from "react";

import {
  createPlaybackTable,
  pathPositionAtTime,
  timeAtPathPosition,
  type CompiledTrajectory,
} from "@/entities/trajectory";

import { useEditorStore, useEditorStoreApi } from "./editor-store-provider";

export function useTrajectoryPlayback(trajectory: CompiledTrajectory | null) {
  const table = useMemo(() => trajectory ? createPlaybackTable(trajectory) : [], [trajectory]);
  const duration = table.at(-1)?.time ?? 0;
  const store = useEditorStoreApi();
  const { elapsed, pathPosition, playing } = useEditorStore((state) => state.playback);
  const { resetPlayback, setPlaybackFrame, setPlaying } = useEditorStore(
    (state) => state.playbackActions,
  );
  const trajectoryKey = trajectory ? `${trajectory.project_id}:${trajectory.revision}` : null;

  useEffect(() => {
    resetPlayback();
  }, [resetPlayback, trajectoryKey]);

  useEffect(() => {
    if (!playing || duration <= 0) return;
    let frame = 0;
    let previous = performance.now();
    let currentElapsed = store.getState().playback.elapsed;

    function animate(now: number) {
      currentElapsed += (now - previous) / 1000;
      previous = now;
      if (currentElapsed >= duration) {
        setPlaybackFrame(1, duration);
        setPlaying(false);
        return;
      }
      setPlaybackFrame(pathPositionAtTime(table, currentElapsed), currentElapsed);
      frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration, playing, setPlaybackFrame, setPlaying, store, table]);

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
