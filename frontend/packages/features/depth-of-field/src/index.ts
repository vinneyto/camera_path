"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { DepthOfFieldScene } from "./scene/scene";
import { DepthOfFieldEffect } from "./timeline/add-effect";
import { DepthOfFieldTimeline } from "./timeline/timeline";

export const slots = {
  project: {
    scene: [DepthOfFieldScene],
  },
  timeline: {
    effects: [DepthOfFieldEffect],
    tracks: [DepthOfFieldTimeline],
  },
} as const satisfies FeatureSlots;
