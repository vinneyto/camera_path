"use client";
import { useSetLidarTimelineMutation } from "@camera-path/actions";
import { useLidarTimelineResource } from "@camera-path/api/resources";

import { TimelineLane } from "@camera-path/ui-kit/timeline/timeline-lane";
import { createLidarTrack } from "./create-lidar-track";
export function LidarTimeline() {
  const timeline = useLidarTimelineResource();
  const mutation = useSetLidarTimelineMutation();
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
