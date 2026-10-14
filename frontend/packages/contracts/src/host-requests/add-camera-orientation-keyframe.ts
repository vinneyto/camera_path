import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const addCameraOrientationKeyframe = defineRequest(
  "host.addCameraOrientationKeyframe@1",
  "Add a camera orientation keyframe.",
  apiSchema<Api.CameraOrientationKeyframeCreate>(
    "CameraOrientationKeyframeCreate",
  ),
  voidSchema,
  true,
);
