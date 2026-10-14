"use client";
import type { PlaybackTrajectory } from "@camera-path/contracts/timeline-views";

import { useEffect } from "react";

import {
  createPlaybackTable,
  pathPositionAtTime,
} from "@camera-path/trajectory-math";

import { playbackState } from "@camera-path/contracts/host-data";
import {
  resetPlayback,
  setPlaybackFrame,
  setPlaying,
} from "@camera-path/contracts/host-requests";
import {
  useData,
  useFeatureHost,
  useRequestAction,
} from "@camera-path/extension-api";
import { manifest } from "../manifest";

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
  const playing = useData(manifest, playbackState).playing;
  const reset = useRequestAction(manifest, resetPlayback);
  const frame = useRequestAction(manifest, setPlaybackFrame);
  const play = useRequestAction(manifest, setPlaying);
  const host = useFeatureHost(manifest);
  const trajectoryKey = trajectory
    ? `${trajectory.project_id}:${trajectory.revision}`
    : null;

  useEffect(() => {
    void reset(undefined);
  }, [reset, trajectoryKey]);

  useEffect(() => {
    if (!playing || duration <= 0) return;
    let animationFrame = 0;
    let previous = performance.now();
    let currentElapsed = host.data.read(playbackState).elapsed;

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
  }, [duration, playing, frame, play, host, table]);

  return null;
}
