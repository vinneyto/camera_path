"use client";
import type { TimelineContribution } from "@camera-path/contracts/timeline-contribution";
import type { AimTimelineInput } from "@camera-path/contracts/timeline-views";
import { createAimTrack } from "./timeline/create-aim-track";
export const timelineContribution: TimelineContribution<AimTimelineInput> = {
  id: "camera-aim.track",
  createTrack: (i) => {
    const track = createAimTrack(i);
    return track.keyframes.length ? track : null;
  },
};
