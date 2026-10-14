import { generatedSchema } from "../generated-schema";
import type * as Api from "../api";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const updateCameraOrientationKeyframe = defineRequest(
  "host.updateCameraOrientationKeyframe@1",
  "Update an existing camera orientation keyframe.",
  generatedSchema("updateCameraOrientationKeyframe"),
  voidSchema,
  true,
);

export interface UpdateCameraOrientationKeyframeInput {
  keyframeId: string;
  keyframe: Api.CameraOrientationKeyframeUpdate;
}
