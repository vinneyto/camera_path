import type { FeatureSlots } from "@camera-path/slots";
import { CameraAimTimeline } from "./timeline/timeline";

export const slots = {
  timeline: {
    tracks: [CameraAimTimeline],
  },
} as const satisfies FeatureSlots;
