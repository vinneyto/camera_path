import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { defineDataContract } from "../define-data-contract";
export const orientationTimeline = defineDataContract(
  "host.orientationTimeline@1",
  "Default camera orientation and orientation keyframes.",
  apiSchema<Api.OrientationTimeline>("OrientationTimeline"),
);
