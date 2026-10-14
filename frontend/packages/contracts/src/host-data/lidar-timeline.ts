import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { defineDataContract } from "../define-data-contract";
export const lidarTimeline = defineDataContract(
  "host.lidarTimeline@1",
  "LiDAR scan settings and their trajectory position.",
  apiSchema<Api.LidarTimeline>("LidarTimeline"),
);
