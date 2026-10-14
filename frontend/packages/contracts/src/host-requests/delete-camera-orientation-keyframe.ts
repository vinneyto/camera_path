import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const deleteCameraOrientationKeyframe = defineRequest(
  "host.deleteCameraOrientationKeyframe@1",
  "Delete a camera orientation keyframe.",
  stringSchema,
  voidSchema,
  true,
);
