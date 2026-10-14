import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const updateDefaultCameraOrientation = defineRequest(
  "host.updateDefaultCameraOrientation@1",
  "Set the default orientation of the trajectory camera.",
  apiSchema<Api.CameraOrientation>("CameraOrientation"),
  voidSchema,
  true,
);
