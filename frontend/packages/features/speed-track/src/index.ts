import type { FeatureSlots } from "@camera-path/slots";
import { SpeedTimeline } from "./timeline/timeline";

import { RemoveSpeedCommand } from "./commands/remove-speed-command";

export const slots = {
  project: { commands: [RemoveSpeedCommand] },
  timeline: {
    tracks: [SpeedTimeline],
  },
} as const satisfies FeatureSlots;
