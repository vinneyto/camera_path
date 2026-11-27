import type { FeatureSlots } from "@camera-path/slots";
import { ChatSidebar } from "./ui/sidebar";

import { GenerationPlacementEffect } from "./effects/generation-placement-effect";
import { PipelineEventsEffect } from "./effects/pipeline-events-effect";

export const slots = {
  project: {
    root: [GenerationPlacementEffect, PipelineEventsEffect],
    sidebar: [ChatSidebar],
  },
} as const satisfies FeatureSlots;
