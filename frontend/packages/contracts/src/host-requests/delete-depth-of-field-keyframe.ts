import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const deleteDepthOfFieldKeyframe = defineRequest(
  "host.deleteDepthOfFieldKeyframe@1",
  "Delete a depth-of-field keyframe.",
  stringSchema,
  voidSchema,
  true,
);
