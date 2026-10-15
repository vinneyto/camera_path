"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { SpeedTimeline } from "./timeline/timeline";

export const slots = {
  timeline: {
    tracks: [SpeedTimeline],
  },
} as const satisfies FeatureSlots;
