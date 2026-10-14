import { generatedSchema } from "../generated-schema";

import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const setLidarTimeline = defineRequest(
  "host.setLidarTimeline@1",
  "Set or remove the LiDAR timeline settings.",
  generatedSchema("setLidarTimeline"),
  voidSchema,
  true,
);
