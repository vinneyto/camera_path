"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { PlaybackControls } from "./ui/controls";
import { PlaybackLoop } from "./ui/playback-loop";

export const slots = {
  project: {
    root: [PlaybackLoop],
  },
  timeline: {
    controls: [PlaybackControls],
  },
} as const satisfies FeatureSlots;
