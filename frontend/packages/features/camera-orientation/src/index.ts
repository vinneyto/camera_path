import type { FeatureSlots } from "@camera-path/slots";
import { CameraOrientationTimeline } from "./timeline/timeline";

export const slots = {
  timeline: {
    tracks: [CameraOrientationTimeline],
  },
} as const satisfies FeatureSlots;
