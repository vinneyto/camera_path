import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const clearTrajectory = defineRequest(
  "host.clearTrajectory@1",
  "Clear the trajectory and reset related editor state.",
  voidSchema,
  voidSchema,
  true,
);
