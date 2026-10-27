import type { FeatureSlots } from "@camera-path/slots";
import { ChatSidebar } from "./ui/sidebar";

export const slots = {
  project: {
    sidebar: [ChatSidebar],
  },
} as const satisfies FeatureSlots;
