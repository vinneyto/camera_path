"use client";
import type { TimelineContribution } from "@camera-path/contracts/timeline-contribution";
import type { LidarTimelineInput } from "@camera-path/contracts/timeline-views";
import { createLidarTrack } from "./timeline/create-lidar-track";
export const timelineContribution: TimelineContribution<LidarTimelineInput> = {
  id: "lidar.track",
  createTrack: (i) =>
    i.keyframe ? createLidarTrack(i.keyframe, () => i.onSet?.(null)) : null,
  effect: {
    label: "LiDAR",
    available: (i) => !i.keyframe && !!i.onSet,
    disabled: (i) => !!i.pending,
    run: (i) => i.onSet?.({}),
  },
};
