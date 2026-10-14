"use client";
import type { TimelineContribution } from "@camera-path/contracts/timeline-contribution";
import type { DepthOfFieldTimelineInput } from "@camera-path/contracts/timeline-views";
import { createDepthOfFieldTrack } from "./timeline/create-depth-of-field-track";
export const timelineContribution: TimelineContribution<DepthOfFieldTimelineInput> =
  {
    id: "depth-of-field.track",
    createTrack: (i) => {
      const track = createDepthOfFieldTrack(i);
      return track.keyframes.length ? track : null;
    },
    effect: {
      label: "Depth of Field",
      available: (i) =>
        !i.trajectory.camera_track.depth_of_field_keyframes.length,
      disabled: (i) => !!i.pending,
      run: (i) => i.onAdd(),
    },
  };
