"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { DepthOfFieldScene } from "./scene/scene";
import { AddDepthOfFieldCommand } from "./commands/add-depth-of-field-command";
import { RemoveDepthOfFieldCommand } from "./commands/remove-depth-of-field-command";
import { DepthOfFieldTimeline } from "./timeline/timeline";

export const slots = {
  project: {
    commands: [AddDepthOfFieldCommand, RemoveDepthOfFieldCommand],
    scene: [DepthOfFieldScene],
  },
  timeline: {
    tracks: [DepthOfFieldTimeline],
  },
} as const satisfies FeatureSlots;
