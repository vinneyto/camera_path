import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { defineDataContract } from "../define-data-contract";
export const aimTimeline = defineDataContract(
  "host.aimTimeline@1",
  "Camera aim targets and keyframes along the trajectory.",
  apiSchema<Api.AimTimeline>("AimTimeline"),
);
