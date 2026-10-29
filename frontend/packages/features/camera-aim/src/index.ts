import type { FeatureSlots } from "@camera-path/slots";
import { CameraAimTimeline } from "./timeline/timeline";

import { RemoveAimCommand } from "./commands/remove-aim-command";

export const slots = {
  project: { commands: [RemoveAimCommand] },
  timeline: {
    tracks: [CameraAimTimeline],
  },
} as const satisfies FeatureSlots;
