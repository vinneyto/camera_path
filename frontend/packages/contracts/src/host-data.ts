import type * as Api from "./api";
import { apiSchema } from "./api-schema";
import { defineDataContract } from "./define-data-contract";
import type {
  CameraMode,
  IdentityState,
  PlaybackState,
  PreferencesState,
  ToolState,
} from "./host-state";
import { jsonSchema } from "./json-schema";
export const projectPermissions = defineDataContract(
  "host.project.permissions@1",
  jsonSchema<{ readonly canEdit: boolean }>({
    type: "object",
    required: ["canEdit"],
    properties: { canEdit: { type: "boolean" } },
    additionalProperties: false,
  }),
);
export const identityState = defineDataContract(
  "host.identity.state@1",
  jsonSchema<IdentityState>({
    type: "object",
    required: [
      "canEdit",
      "loading",
      "username",
      "pending",
      "challenge",
      "errorMessage",
    ],
    properties: {
      canEdit: { type: "boolean" },
      loading: { type: "boolean" },
      username: { type: ["string", "null"] },
      pending: { type: "boolean" },
      errorMessage: { type: ["string", "null"] },
      challenge: {
        anyOf: [
          { $ref: "camera-path-api#/components/schemas/ChallengeResponse" },
          { type: "null" },
        ],
      },
    },
  }),
);
export const preferencesState = defineDataContract(
  "host.preferences.state@1",
  jsonSchema<PreferencesState>({
    type: "object",
    required: [
      "webGpuTileRenderer",
      "showGrid",
      "gaussianDpr",
      "ready",
      "loading",
      "saving",
      "errorMessage",
    ],
    properties: {
      webGpuTileRenderer: { type: "boolean" },
      showGrid: { type: "boolean" },
      gaussianDpr: { enum: ["1x", "system"] },
      ready: { type: "boolean" },
      loading: { type: "boolean" },
      saving: { type: "boolean" },
      errorMessage: { type: ["string", "null"] },
    },
  }),
);
export const themeState = defineDataContract(
  "host.appearance.theme@1",
  jsonSchema<"light" | "dark">({ enum: ["light", "dark"] }),
);
export const editorTool = defineDataContract(
  "host.tools.state@1",
  jsonSchema<ToolState>({
    type: "object",
    required: ["activeTool", "hoveredObject", "pendingCloud"],
    properties: {
      activeTool: { enum: [null, "anchor", "anchor-height", "cloud"] },
      hoveredObject: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            required: ["type"],
            properties: {
              type: { enum: ["anchor", "trajectory"] },
              id: { type: "string" },
            },
          },
        ],
      },
      pendingCloud: {
        anyOf: [
          { type: "null" },
          { $ref: "camera-path-api#/components/schemas/LibraryAsset" },
        ],
      },
    },
  }),
);
export const cameraMode = defineDataContract(
  "host.camera.mode@1",
  jsonSchema<CameraMode>({ enum: ["orbit", "trajectory"] }),
);
export const playbackState = defineDataContract(
  "host.playback.state@1",
  jsonSchema<PlaybackState>({
    type: "object",
    required: ["elapsed", "pathPosition", "playing"],
    properties: {
      elapsed: { type: "number", minimum: 0 },
      pathPosition: { type: "number", minimum: 0, maximum: 1 },
      playing: { type: "boolean" },
    },
  }),
);
export const trajectorySelection = defineDataContract(
  "host.trajectory.selection@1",
  jsonSchema<{ readonly trajectorySelected: boolean }>({
    type: "object",
    required: ["trajectorySelected"],
    properties: { trajectorySelected: { type: "boolean" } },
  }),
);
export const projectsCatalog = defineDataContract(
  "host.projectsCatalog@1",
  jsonSchema<Api.ProjectMetadata[]>({
    type: "array",
    items: { $ref: "camera-path-api#/components/schemas/ProjectMetadata" },
  }),
);
export const libraryCatalog = defineDataContract(
  "host.libraryCatalog@1",
  jsonSchema<Api.LibraryAsset[]>({
    type: "array",
    items: { $ref: "camera-path-api#/components/schemas/LibraryAsset" },
  }),
);
export const libraryAsset = defineDataContract(
  "host.libraryAsset@1",
  apiSchema<Api.LibraryAsset>("LibraryAsset"),
);
export const sceneModels = defineDataContract(
  "host.sceneModels@1",
  jsonSchema<Api.ProjectCloud[]>({
    type: "array",
    items: { $ref: "camera-path-api#/components/schemas/ProjectCloud" },
  }),
);
export const anchors = defineDataContract(
  "host.anchors@1",
  jsonSchema<Api.Anchor[]>({
    type: "array",
    items: { $ref: "camera-path-api#/components/schemas/Anchor" },
  }),
);
export const scenePoints = defineDataContract(
  "host.scenePoints@1",
  jsonSchema<Api.ScenePoint[]>({
    type: "array",
    items: { $ref: "camera-path-api#/components/schemas/ScenePoint" },
  }),
);
export const trajectoryGeometry = defineDataContract(
  "host.trajectoryGeometry@1",
  apiSchema<Api.Trajectory>("Trajectory"),
);
export const speedTimeline = defineDataContract(
  "host.speedTimeline@1",
  apiSchema<Api.MotionProfile>("MotionProfile"),
);
export const aimTimeline = defineDataContract(
  "host.aimTimeline@1",
  apiSchema<Api.AimTimeline>("AimTimeline"),
);
export const orientationTimeline = defineDataContract(
  "host.orientationTimeline@1",
  apiSchema<Api.OrientationTimeline>("OrientationTimeline"),
);
export const depthOfFieldTimeline = defineDataContract(
  "host.depthOfFieldTimeline@1",
  apiSchema<Api.DepthOfFieldTimeline>("DepthOfFieldTimeline"),
);
export const lidarTimeline = defineDataContract(
  "host.lidarTimeline@1",
  apiSchema<Api.LidarTimeline>("LidarTimeline"),
);
export const chatHistory = defineDataContract(
  "host.chatHistory@1",
  jsonSchema<Api.ChatHistoryMessage[]>({
    type: "array",
    items: { $ref: "camera-path-api#/components/schemas/ChatHistoryMessage" },
  }),
);
export const compiledTrajectory = defineDataContract(
  "host.compiledTrajectory@1",
  apiSchema<Api.CompiledTrajectory>("CompiledTrajectory"),
);
export const trajectoryCameraPose = defineDataContract(
  "host.trajectoryCamera.pose@1",
  jsonSchema<import("./camera-pose").TrajectoryCameraPose | null>({
    anyOf: [
      { type: "null" },
      {
        type: "object",
        required: [
          "position",
          "orientation",
          "up",
          "frameId",
          "projectRevision",
        ],
        properties: {
          position: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: { type: "number" },
          },
          orientation: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "number" },
          },
          up: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: { type: "number" },
          },
          frameId: { type: "integer", minimum: 0 },
          projectRevision: { type: "integer", minimum: 0 },
        },
      },
    ],
  }),
);
