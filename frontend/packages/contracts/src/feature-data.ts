import { defineDataContract } from "./define-data-contract";
import {
  cameraMode as hostCameraMode,
  playbackState as hostPlaybackState,
  trajectorySelection as hostTrajectorySelection,
} from "./host-data";
import { jsonSchema } from "./json-schema";
export const playbackOutput = defineDataContract(
  "playback.state@1",
  hostPlaybackState.schema,
);
export const cameraModeOutput = defineDataContract(
  "camera-view.mode@1",
  hostCameraMode.schema,
);
export const trajectorySelectionOutput = defineDataContract(
  "trajectory.selection@1",
  hostTrajectorySelection.schema,
);
export interface LidarStatus {
  readonly state:
    "disabled" | "initializing" | "ready" | "unavailable" | "failed";
  readonly message: string | null;
}
export const lidarStatus = defineDataContract(
  "lidar.status@1",
  jsonSchema<LidarStatus>({
    type: "object",
    required: ["state", "message"],
    properties: {
      state: {
        enum: ["disabled", "initializing", "ready", "unavailable", "failed"],
      },
      message: { type: ["string", "null"] },
    },
  }),
);
