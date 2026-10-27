import type { FeatureSlots } from "@camera-path/slots";
import { RendererSettings } from "./ui/renderer-settings";

export const slots = {
  settings: {
    content: [RendererSettings],
  },
} as const satisfies FeatureSlots;
