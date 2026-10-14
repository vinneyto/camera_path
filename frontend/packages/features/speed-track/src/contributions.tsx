"use client";
import type { TimelineContribution } from "@camera-path/contracts/timeline-contribution";
import type { SpeedTimelineInput } from "@camera-path/contracts/timeline-views";
import { SpeedGraph } from "./ui/speed-graph";
export const timelineContribution: TimelineContribution<SpeedTimelineInput> = {
  id: "speed-track.track",
  render: (i) => <SpeedGraph {...i} />,
};
