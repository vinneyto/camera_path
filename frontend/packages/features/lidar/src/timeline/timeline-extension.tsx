"use client";
import { lidarTimeline } from "@camera-path/contracts/host-data";
import { setLidarTimeline } from "@camera-path/contracts/host-requests";
import { useDataQuery, useRequestMutation } from "@camera-path/extension-api";
import { TimelineLane } from "@camera-path/ui-kit/timeline/timeline-lane";
import { createLidarTrack } from "./create-lidar-track";
import { manifest } from "../manifest";
export function TimelineExtension() {
  const timeline = useDataQuery(manifest, lidarTimeline);
  const mutation = useRequestMutation(manifest, setLidarTimeline);
  const keyframe = timeline.data?.data.lidar_keyframe;
  return (
    <TimelineLane
      track={
        keyframe
          ? createLidarTrack(keyframe, () => mutation.mutate(null))
          : null
      }
      error={mutation.error ?? timeline.error}
    />
  );
}
