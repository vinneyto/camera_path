import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const hoverTrajectory = defineRequest(
  "host.hoverTrajectory@1",
  "Mark the trajectory as hovered.",
  voidSchema,
  voidSchema,
  false,
);
