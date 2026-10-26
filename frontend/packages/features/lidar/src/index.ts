"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { AddLidarCommand } from "./commands/add-lidar-command";
import { RemoveLidarCommand } from "./commands/remove-lidar-command";
import { LidarTimeline } from "./timeline/timeline";
import { LidarScene } from "./ui/scene";

export const slots = {
  project: {
    commands: [AddLidarCommand, RemoveLidarCommand],
    scene: [LidarScene],
  },
  timeline: {
    tracks: [LidarTimeline],
  },
} as const satisfies FeatureSlots;
