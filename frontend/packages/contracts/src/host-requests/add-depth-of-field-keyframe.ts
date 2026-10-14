import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const addDepthOfFieldKeyframe = defineRequest(
  "host.addDepthOfFieldKeyframe@1",
  "Add a depth-of-field keyframe.",
  apiSchema<Api.DepthOfFieldKeyframeCreate>("DepthOfFieldKeyframeCreate"),
  voidSchema,
  true,
);
