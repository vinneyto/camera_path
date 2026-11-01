import type { FeatureSlots } from "@camera-path/slots";
import { JobsPage } from "./ui/jobs-page";

export const slots = {
  jobs: { list: [JobsPage] },
} as const satisfies FeatureSlots;
