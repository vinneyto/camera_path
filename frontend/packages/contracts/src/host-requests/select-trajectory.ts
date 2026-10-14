import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const selectTrajectory = defineRequest(
  "host.selectTrajectory@1",
  "Select the trajectory and expand its controls.",
  voidSchema,
  voidSchema,
  false,
);
