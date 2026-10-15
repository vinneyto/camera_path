"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { LidarCommands } from "./commands";
import { LidarTimeline } from "./timeline/timeline";
import { LidarScene } from "./ui/scene";

export const slots = {
  project: {
    commands: [LidarCommands],
    scene: [LidarScene],
  },
  timeline: {
    tracks: [LidarTimeline],
  },
} as const satisfies FeatureSlots;
