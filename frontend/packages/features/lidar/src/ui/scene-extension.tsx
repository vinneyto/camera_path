"use client";
import {
  compiledTrajectory,
  lidarTimeline,
} from "@camera-path/contracts/host-data";
import { useDataQuery } from "@camera-path/extension-api";
import { manifest } from "../manifest";
import { LidarCloud } from "./lidar-cloud";
export function SceneExtension() {
  const trajectory = useDataQuery(manifest, compiledTrajectory);
  const timeline = useDataQuery(manifest, lidarTimeline);
  const keyframe = timeline.data?.data.lidar_keyframe;
  return keyframe && trajectory.data?.data.position_segments.length ? (
    <LidarCloud settings={keyframe} />
  ) : null;
}
