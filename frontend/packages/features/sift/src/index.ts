import type { FeatureSlots } from "@camera-path/slots";
import { SiftPage } from "./ui/sift-page";
export const slots = {
  sift: { content: [SiftPage] },
} as const satisfies FeatureSlots;
