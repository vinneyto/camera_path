import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { defineDataContract } from "../define-data-contract";
export const speedTimeline = defineDataContract(
  "host.speedTimeline@1",
  "Speed keyframes and motion settings along the trajectory.",
  apiSchema<Api.MotionProfile>("MotionProfile"),
);
