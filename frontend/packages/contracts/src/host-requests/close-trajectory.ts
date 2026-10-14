import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const closeTrajectory = defineRequest(
  "host.closeTrajectory@1",
  "Clear trajectory selection and collapse its controls.",
  voidSchema,
  voidSchema,
  false,
);
