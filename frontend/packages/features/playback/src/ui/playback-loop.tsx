"use client";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";

import { TrajectoryPlaybackLoop } from "./trajectory-playback-loop";
export function PlaybackLoop() {
  const query = useCompiledTrajectoryResource();
  return <TrajectoryPlaybackLoop trajectory={query.data?.data ?? null} />;
}
