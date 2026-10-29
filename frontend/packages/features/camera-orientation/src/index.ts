import type { FeatureSlots } from "@camera-path/slots";
import { CameraOrientationTimeline } from "./timeline/timeline";

import { RemoveOrientationCommand } from "./commands/remove-orientation-command";

export const slots = {
  project: { commands: [RemoveOrientationCommand] },
  timeline: {
    tracks: [CameraOrientationTimeline],
  },
} as const satisfies FeatureSlots;
