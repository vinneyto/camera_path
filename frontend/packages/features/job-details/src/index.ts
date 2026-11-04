import type { FeatureSlots } from "@camera-path/slots";
import { JobDetailsPage } from "./ui/job-details-page";

export const slots = {
  jobs: { details: [JobDetailsPage] },
} as const satisfies FeatureSlots;
