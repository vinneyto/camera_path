import type { FeatureSlots } from "@camera-path/slots";
import { ChatSidebar } from "./ui/sidebar";

import { GenerationPlacementEffect } from "./effects/generation-placement-effect";

export const slots = {
  project: {
    root: [GenerationPlacementEffect],
    sidebar: [ChatSidebar],
  },
} as const satisfies FeatureSlots;
