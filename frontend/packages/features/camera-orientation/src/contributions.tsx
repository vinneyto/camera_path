"use client";
import type { TimelineContribution } from "@camera-path/contracts/timeline-contribution";
import type { OrientationTimelineInput } from "@camera-path/contracts/timeline-views";
import { createOrientationTrack } from "./timeline/create-orientation-track";
export const timelineContribution: TimelineContribution<OrientationTimelineInput> =
  {
    id: "camera-orientation.track",
    createTrack: (i) => {
      const track = createOrientationTrack(i);
      return track.keyframes.length ? track : null;
    },
  };
