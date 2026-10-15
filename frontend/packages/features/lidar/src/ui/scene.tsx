"use client";
import {
  useCompiledTrajectoryResource,
  useLidarTimelineResource,
} from "@camera-path/api/resources";

import { LidarCloud } from "./lidar-cloud";
export function LidarScene() {
  const trajectory = useCompiledTrajectoryResource();
  const timeline = useLidarTimelineResource();
  const keyframe = timeline.data?.data.lidar_keyframe;
  return keyframe && trajectory.data?.data.position_segments.length ? (
    <LidarCloud settings={keyframe} />
  ) : null;
}
