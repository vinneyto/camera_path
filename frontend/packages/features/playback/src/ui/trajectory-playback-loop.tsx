"use client";
import { useEditorActions } from "@camera-path/actions";
import { useEditorStoreApi, usePlaybackState } from "@camera-path/store";

import type { PlaybackTrajectory } from "@camera-path/types/timeline-views";

import { useEffect } from "react";

import {
  createPlaybackTable,
  pathPositionAtTime,
} from "@camera-path/trajectory-math";

interface TrajectoryPlaybackLoopProps {
  trajectory: PlaybackTrajectory | null;
}

export function TrajectoryPlaybackLoop({
  trajectory,
}: TrajectoryPlaybackLoopProps) {
  // React Compiler caches this derived value while trajectory is unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const table = trajectory ? createPlaybackTable(trajectory) : [];
  const duration = table.at(-1)?.time ?? 0;
  const playing = usePlaybackState().playing;
  const reset = useEditorActions().resetPlayback;
  const frame = useEditorActions().setPlaybackFrame;
  const play = useEditorActions().setPlaying;
  const store = useEditorStoreApi();
  const trajectoryKey = trajectory
    ? `${trajectory.project_id}:${trajectory.revision}`
    : null;

  useEffect(() => {
    void reset();
  }, [reset, trajectoryKey]);

  useEffect(() => {
    if (!playing || duration <= 0) return;
    let animationFrame = 0;
    let previous = performance.now();
    let currentElapsed = store.getState().playback.elapsed;

    function animate(now: number) {
      currentElapsed += (now - previous) / 1000;
      previous = now;
      if (currentElapsed >= duration) {
        void frame({ pathPosition: 1, elapsed: duration });
        void play(false);
        return;
      }
      void frame({
        pathPosition: pathPositionAtTime(table, currentElapsed),
        elapsed: currentElapsed,
      });
      animationFrame = requestAnimationFrame(animate);
    }

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [duration, playing, frame, play, store, table]);

  return null;
}
