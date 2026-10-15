"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { LidarEffect } from "./timeline/add-effect";
import { LidarTimeline } from "./timeline/timeline";
import { LidarScene } from "./ui/scene";

export const slots = {
  project: {
    scene: [LidarScene],
  },
  timeline: {
    effects: [LidarEffect],
    tracks: [LidarTimeline],
  },
} as const satisfies FeatureSlots;
