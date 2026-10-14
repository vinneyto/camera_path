import type * as Api from "./api";
import { apiSchema } from "./api-schema";
import { booleanSchema, stringSchema, voidSchema } from "./basic-schemas";
import { defineRequest } from "./define-request";
import type { CameraMode, EditorTool } from "./host-state";
import { jsonSchema } from "./json-schema";
import { valueSchema } from "./value-schema";
export type CloudAction =
  | { type: "add"; assetId: string; translation?: [number, number, number] }
  | { type: "remove"; cloudId: string }
  | { type: "update"; cloudId: string; changes: Api.ProjectCloudUpdate };
const cloudActionSchema = jsonSchema<CloudAction>({
  oneOf: [
    {
      type: "object",
      required: ["type", "assetId"],
      properties: {
        type: { const: "add" },
        assetId: { type: "string" },
        translation: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "number" },
        },
      },
    },
    {
      type: "object",
      required: ["type", "cloudId"],
      properties: { type: { const: "remove" }, cloudId: { type: "string" } },
    },
    {
      type: "object",
      required: ["type", "cloudId", "changes"],
      properties: {
        type: { const: "update" },
        cloudId: { type: "string" },
        changes: {
          $ref: "camera-path-api#/components/schemas/ProjectCloudUpdate",
        },
      },
    },
  ],
});
export const createProject = defineRequest(
  "host.createProject@1",
  stringSchema,
  apiSchema<Api.ProjectMetadata>("ProjectMetadata"),
  true,
);
export const deleteProject = defineRequest(
  "host.deleteProject@1",
  stringSchema,
  voidSchema,
  true,
);
export const addAnchor = defineRequest(
  "host.addAnchor@1",
  apiSchema<Api.AnchorCreate>("AnchorCreate"),
  voidSchema,
  true,
);
export const updateAnchor = defineRequest(
  "host.updateAnchor@1",
  jsonSchema<{ anchorId: string; lift: number }>({
    type: "object",
    required: ["anchorId", "lift"],
    properties: { anchorId: { type: "string" }, lift: { type: "number" } },
  }),
  voidSchema,
  true,
);
export const deleteAnchor = defineRequest(
  "host.deleteAnchor@1",
  stringSchema,
  voidSchema,
  true,
);
export const deleteSpeedKeyframe = defineRequest(
  "host.deleteSpeedKeyframe@1",
  stringSchema,
  voidSchema,
  true,
);
export const deleteCameraKeyframe = defineRequest(
  "host.deleteCameraKeyframe@1",
  stringSchema,
  voidSchema,
  true,
);
export const deleteCameraOrientationKeyframe = defineRequest(
  "host.deleteCameraOrientationKeyframe@1",
  stringSchema,
  voidSchema,
  true,
);
export const deleteDepthOfFieldKeyframe = defineRequest(
  "host.deleteDepthOfFieldKeyframe@1",
  stringSchema,
  voidSchema,
  true,
);
export const clearTrajectory = defineRequest(
  "host.clearTrajectory@1",
  voidSchema,
  voidSchema,
  true,
);
export const addCameraOrientationKeyframe = defineRequest(
  "host.addCameraOrientationKeyframe@1",
  apiSchema<Api.CameraOrientationKeyframeCreate>(
    "CameraOrientationKeyframeCreate",
  ),
  voidSchema,
  true,
);
export const updateDefaultCameraOrientation = defineRequest(
  "host.updateDefaultCameraOrientation@1",
  apiSchema<Api.CameraOrientation>("CameraOrientation"),
  voidSchema,
  true,
);
export const updateCameraOrientationKeyframe = defineRequest(
  "host.updateCameraOrientationKeyframe@1",
  jsonSchema<{
    keyframeId: string;
    keyframe: Api.CameraOrientationKeyframeUpdate;
  }>({
    type: "object",
    required: ["keyframeId", "keyframe"],
    properties: {
      keyframeId: { type: "string" },
      keyframe: {
        $ref: "camera-path-api#/components/schemas/CameraOrientationKeyframeUpdate",
      },
    },
  }),
  voidSchema,
  true,
);
export const addDepthOfFieldKeyframe = defineRequest(
  "host.addDepthOfFieldKeyframe@1",
  apiSchema<Api.DepthOfFieldKeyframeCreate>("DepthOfFieldKeyframeCreate"),
  voidSchema,
  true,
);
export const setLidarTimeline = defineRequest(
  "host.setLidarTimeline@1",
  jsonSchema<Api.LidarSettings | null>({
    anyOf: [
      { $ref: "camera-path-api#/components/schemas/LidarSettings" },
      { type: "null" },
    ],
  }),
  voidSchema,
  true,
);
export const projectCloudAction = defineRequest(
  "host.projectCloudAction@1",
  cloudActionSchema,
  jsonSchema<{ status: number }>({
    type: "object",
    required: ["status"],
    properties: { status: { type: "integer" } },
  }),
  true,
);
export const deleteLibraryAssets = defineRequest(
  "host.deleteLibraryAssets@1",
  jsonSchema<string[]>({ type: "array", items: { type: "string" } }),
  voidSchema,
  true,
);
export const uploadLibraryFile = defineRequest(
  "host.uploadLibraryFile@1",
  valueSchema(
    (v): v is File => typeof File !== "undefined" && v instanceof File,
    "File",
  ),
  voidSchema,
  true,
);
export const updateLibraryDefaults = defineRequest(
  "host.updateLibraryDefaults@1",
  jsonSchema<{ assetId: string; changes: Api.LibraryAssetDefaultsUpdate }>({
    type: "object",
    required: ["assetId", "changes"],
    properties: {
      assetId: { type: "string" },
      changes: {
        $ref: "camera-path-api#/components/schemas/LibraryAssetDefaultsUpdate",
      },
    },
  }),
  voidSchema,
  true,
);
export const savePreferences = defineRequest(
  "host.savePreferences@1",
  apiSchema<Api.UserSettingsUpdate>("UserSettingsUpdate"),
  voidSchema,
  false,
);
export const retryPreferences = defineRequest(
  "host.retryPreferences@1",
  voidSchema,
  voidSchema,
  false,
);
export const toggleTheme = defineRequest(
  "host.toggleTheme@1",
  voidSchema,
  voidSchema,
  false,
);
export const login = defineRequest(
  "host.login@1",
  jsonSchema<{ username: string; password: string }>({
    type: "object",
    required: ["username", "password"],
    properties: { username: { type: "string" }, password: { type: "string" } },
  }),
  booleanSchema,
  false,
);
export const verify = defineRequest(
  "host.verify@1",
  stringSchema,
  voidSchema,
  false,
);
export const resend = defineRequest(
  "host.resend@1",
  voidSchema,
  voidSchema,
  false,
);
export const cancelLogin = defineRequest(
  "host.cancelLogin@1",
  voidSchema,
  voidSchema,
  false,
);
export const logout = defineRequest(
  "host.logout@1",
  voidSchema,
  voidSchema,
  false,
);
export const setActiveTool = defineRequest(
  "host.setActiveTool@1",
  jsonSchema<EditorTool | null>({
    enum: [null, "anchor", "anchor-height", "cloud"],
  }),
  voidSchema,
  false,
);
export const startCloudPlacement = defineRequest(
  "host.startCloudPlacement@1",
  apiSchema<Api.LibraryAsset>("LibraryAsset"),
  voidSchema,
  true,
);
export const setCameraMode = defineRequest(
  "host.setCameraMode@1",
  jsonSchema<CameraMode>({ enum: ["orbit", "trajectory"] }),
  voidSchema,
  false,
);
export const hoverAnchor = defineRequest(
  "host.hoverAnchor@1",
  stringSchema,
  voidSchema,
  false,
);
export const clearHoveredAnchor = defineRequest(
  "host.clearHoveredAnchor@1",
  stringSchema,
  voidSchema,
  false,
);
export const hoverTrajectory = defineRequest(
  "host.hoverTrajectory@1",
  voidSchema,
  voidSchema,
  false,
);
export const clearHoveredTrajectory = defineRequest(
  "host.clearHoveredTrajectory@1",
  voidSchema,
  voidSchema,
  false,
);
export const selectTrajectory = defineRequest(
  "host.selectTrajectory@1",
  voidSchema,
  voidSchema,
  false,
);
export const closeTrajectory = defineRequest(
  "host.closeTrajectory@1",
  voidSchema,
  voidSchema,
  false,
);
export const resetPlayback = defineRequest(
  "host.resetPlayback@1",
  voidSchema,
  voidSchema,
  false,
);
export const setPlaybackFrame = defineRequest(
  "host.setPlaybackFrame@1",
  jsonSchema<{ pathPosition: number; elapsed: number }>({
    type: "object",
    required: ["pathPosition", "elapsed"],
    properties: {
      pathPosition: { type: "number", minimum: 0, maximum: 1 },
      elapsed: { type: "number", minimum: 0 },
    },
  }),
  voidSchema,
  false,
);
export const setPlaying = defineRequest(
  "host.setPlaying@1",
  booleanSchema,
  voidSchema,
  false,
);
export const navigate = defineRequest(
  "host.navigate@1",
  stringSchema,
  voidSchema,
  false,
);
export interface SendChatMessageInput {
  id: string;
  message: string;
  onAccepted: () => void;
}
export const sendChatMessage = defineRequest(
  "host.chat.send@1",
  valueSchema(
    (v): v is SendChatMessageInput =>
      !!v &&
      typeof v === "object" &&
      "id" in v &&
      typeof v.id === "string" &&
      "message" in v &&
      typeof v.message === "string" &&
      "onAccepted" in v &&
      typeof v.onAccepted === "function",
    "chat request",
  ),
  apiSchema<Api.ChatResponse>("ChatResponse"),
);
