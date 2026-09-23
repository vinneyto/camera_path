import * as api from "@/shared/api/generated/client";
import type {
  AnchorCreate,
  AnchorUpdate,
  CameraOrientation,
  CameraOrientationKeyframeCreate,
  CameraOrientationKeyframeUpdate,
  DepthOfFieldKeyframeCreate,
  DepthOfFieldKeyframeUpdate,
  ChatResponse,
} from "@/shared/api/generated/model";
import {
  rememberProjectRevision,
  forgetProjectRevision,
} from "@/shared/api/orval-fetch";

// The generated client owns all HTTP paths and payloads. These small wrappers expose
// successful response bodies to the editor's existing feature hooks.
export const projectApi = {
  create: async (name: string) => {
    const response = await api.createProject({ name });
    if (response.status !== 201) throw new Error("Could not create project");
    rememberProjectRevision(response.data.id, response.data.revision);
    return response.data;
  },
  delete: async (id: string) => {
    await api.deleteProject(id);
    forgetProjectRevision(id);
  },
  addAnchor: async (id: string, anchor: AnchorCreate) =>
    (await api.createAnchor(id, anchor)).data,
  updateAnchor: async (id: string, anchorId: string, anchor: AnchorUpdate) =>
    (await api.updateAnchor(id, anchorId, anchor)).data,
  deleteAnchor: async (id: string, anchorId: string) => {
    await api.deleteAnchor(id, anchorId);
  },
  deleteSpeedKeyframe: async (id: string, keyframeId: string) => {
    await api.deleteSpeedKeyframe(id, keyframeId);
  },
  deleteCameraKeyframe: async (id: string, keyframeId: string) => {
    await api.deleteCameraAimKeyframe(id, keyframeId);
  },
  updateDefaultCameraOrientation: async (
    id: string,
    orientation: CameraOrientation,
  ) => (await api.updateCameraOrientation(id, orientation)).data,
  addCameraOrientationKeyframe: async (
    id: string,
    keyframe: CameraOrientationKeyframeCreate,
  ) => (await api.createCameraOrientationKeyframe(id, keyframe)).data,
  updateCameraOrientationKeyframe: async (
    id: string,
    keyframeId: string,
    keyframe: CameraOrientationKeyframeUpdate,
  ) =>
    (await api.updateCameraOrientationKeyframe(id, keyframeId, keyframe)).data,
  deleteCameraOrientationKeyframe: async (id: string, keyframeId: string) => {
    await api.deleteCameraOrientationKeyframe(id, keyframeId);
  },
  addDepthOfFieldKeyframe: async (
    id: string,
    keyframe: DepthOfFieldKeyframeCreate,
  ) => (await api.createDepthOfFieldKeyframe(id, keyframe)).data,
  updateDepthOfFieldKeyframe: async (
    id: string,
    keyframeId: string,
    keyframe: DepthOfFieldKeyframeUpdate,
  ) => (await api.updateDepthOfFieldKeyframe(id, keyframeId, keyframe)).data,
  deleteDepthOfFieldKeyframe: async (id: string, keyframeId: string) => {
    await api.deleteDepthOfFieldKeyframe(id, keyframeId);
  },
  clearTrajectory: async (id: string) => {
    await api.clearTrajectory(id);
  },
  saveUserMessage: async (id: string, messageId: string, message: string) =>
    (await api.saveUserChatMessage(id, { id: messageId, message })).data,
  chat: async (
    id: string,
    messageId: string,
    message: string,
  ): Promise<ChatResponse> => {
    const response = await api.createChatMessage(id, {
      id: messageId,
      message,
    });
    if (response.status !== 200) throw new Error("Could not send message");
    return response.data;
  },
};
