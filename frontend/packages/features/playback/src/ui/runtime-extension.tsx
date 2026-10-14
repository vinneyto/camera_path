"use client";
import { compiledTrajectory } from "@camera-path/contracts/host-data";
import { useDataQuery } from "@camera-path/extension-api";
import { manifest } from "../manifest";
import { TrajectoryPlaybackLoop } from "./trajectory-playback-loop";
export function RuntimeExtension() {
  const query = useDataQuery(manifest, compiledTrajectory);
  return <TrajectoryPlaybackLoop trajectory={query.data?.data ?? null} />;
}
