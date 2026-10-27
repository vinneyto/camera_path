import type { FeatureSlots } from "@camera-path/slots";
import { LibraryContent } from "./ui/content";
import { LibraryDetails } from "./ui/details";

export const slots = {
  library: {
    content: [LibraryContent],
    details: [LibraryDetails],
  },
} as const satisfies FeatureSlots;
