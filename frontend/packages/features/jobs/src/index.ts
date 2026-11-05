import type { FeatureSlots } from "@camera-path/slots";
import { JobCreatePage } from "./ui/job-create-page";
import { JobsPage } from "./ui/jobs-page";

export const slots = {
  jobs: { list: [JobsPage], create: [JobCreatePage] },
} as const satisfies FeatureSlots;
