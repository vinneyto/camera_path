import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { defineDataContract } from "../define-data-contract";
export const depthOfFieldTimeline = defineDataContract(
  "host.depthOfFieldTimeline@1",
  "Depth-of-field focus and blur keyframes.",
  apiSchema<Api.DepthOfFieldTimeline>("DepthOfFieldTimeline"),
);
