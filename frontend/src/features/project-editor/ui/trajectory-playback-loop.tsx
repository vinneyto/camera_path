"use client";

import { useEffect, useMemo } from "react";

import {
  createPlaybackTable,
  pathPositionAtTime,
  type CompiledTrajectory,
} from "@/entities/trajectory";

import {
  useEditorStore,
  useEditorStoreApi,
} from "../model/editor-store-provider";

interface TrajectoryPlaybackLoopProps {
  trajectory: CompiledTrajectory | null;
}

export function TrajectoryPlaybackLoop({
  trajectory,
}: TrajectoryPlaybackLoopProps) {
  const table = useMemo(
    () => (trajectory ? createPlaybackTable(trajectory) : []),
    [trajectory],
  );
  const duration = table.at(-1)?.time ?? 0;
  const playing = useEditorStore((state) => state.playback.playing);
  const { resetPlayback, setPlaybackFrame, setPlaying } = useEditorStore(
    (state) => state.playbackActions,
  );
  const store = useEditorStoreApi();
  const trajectoryKey = trajectory
    ? `${trajectory.project_id}:${trajectory.revision}`
    : null;

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
      setPlaybackFrame(
        pathPositionAtTime(table, currentElapsed),
        currentElapsed,
      );
      frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration, playing, setPlaybackFrame, setPlaying, store, table]);

  return null;
}
