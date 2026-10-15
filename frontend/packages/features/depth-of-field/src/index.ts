"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { DepthOfFieldScene } from "./scene/scene";
import { DepthOfFieldCommands } from "./commands";
import { DepthOfFieldTimeline } from "./timeline/timeline";

export const slots = {
  project: {
    commands: [DepthOfFieldCommands],
    scene: [DepthOfFieldScene],
  },
  timeline: {
    tracks: [DepthOfFieldTimeline],
  },
} as const satisfies FeatureSlots;
