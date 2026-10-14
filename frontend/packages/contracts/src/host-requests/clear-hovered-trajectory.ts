import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const clearHoveredTrajectory = defineRequest(
  "host.clearHoveredTrajectory@1",
  "Clear trajectory hover.",
  voidSchema,
  voidSchema,
  false,
);
