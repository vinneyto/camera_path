import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const deleteCameraKeyframe = defineRequest(
  "host.deleteCameraKeyframe@1",
  "Delete a camera aim keyframe.",
  stringSchema,
  voidSchema,
  true,
);
