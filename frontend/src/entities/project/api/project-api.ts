import type {
  AnchorCreate,
  AnchorUpdate,
  CameraOrientation,
  CameraOrientationKeyframeCreate,
  CameraOrientationKeyframeUpdate,
  DepthOfFieldKeyframeCreate,
  DepthOfFieldKeyframeUpdate,
  Project,
} from "@/entities/project/model/types";
import type {
  ChatResult,
  CompiledTrajectory,
} from "@/entities/trajectory/model/types";
import { apiRequest } from "@/shared/api/http";

export const projectApi = {
  list: () => apiRequest<Project[]>("/projects"),
  get: (projectId: string) => apiRequest<Project>(`/projects/${projectId}`),
  create: (name: string) =>
    apiRequest<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  delete: (projectId: string) =>
    apiRequest<void>(`/projects/${projectId}`, { method: "DELETE" }),
  addAnchor: (projectId: string, anchor: AnchorCreate) =>
    apiRequest<Project>(`/projects/${projectId}/anchors`, {
      method: "POST",
      body: JSON.stringify(anchor),
    }),
  updateAnchor: (projectId: string, anchorId: string, anchor: AnchorUpdate) =>
    apiRequest<Project>(`/projects/${projectId}/anchors/${anchorId}`, {
      method: "PATCH",
      body: JSON.stringify(anchor),
    }),
  deleteAnchor: (projectId: string, anchorId: string) =>
    apiRequest<Project>(`/projects/${projectId}/anchors/${anchorId}`, {
      method: "DELETE",
    }),
  deleteSpeedKeyframe: (projectId: string, keyframeId: string) =>
    apiRequest<Project>(
      `/projects/${projectId}/motion/keyframes/${keyframeId}`,
      { method: "DELETE" },
    ),
  deleteCameraKeyframe: (projectId: string, keyframeId: string) =>
    apiRequest<Project>(
      `/projects/${projectId}/camera/keyframes/${keyframeId}`,
      { method: "DELETE" },
    ),
  updateDefaultCameraOrientation: (
    projectId: string,
    orientation: CameraOrientation,
  ) =>
    apiRequest<Project>(`/projects/${projectId}/camera/orientation`, {
      method: "PATCH",
      body: JSON.stringify(orientation),
    }),
  addCameraOrientationKeyframe: (
    projectId: string,
    keyframe: CameraOrientationKeyframeCreate,
  ) =>
    apiRequest<Project>(`/projects/${projectId}/camera/orientation/keyframes`, {
      method: "POST",
      body: JSON.stringify(keyframe),
    }),
  updateCameraOrientationKeyframe: (
    projectId: string,
    keyframeId: string,
    keyframe: CameraOrientationKeyframeUpdate,
  ) =>
    apiRequest<Project>(
      `/projects/${projectId}/camera/orientation/keyframes/${keyframeId}`,
      {
        method: "PATCH",
        body: JSON.stringify(keyframe),
      },
    ),
  deleteCameraOrientationKeyframe: (projectId: string, keyframeId: string) =>
    apiRequest<Project>(
      `/projects/${projectId}/camera/orientation/keyframes/${keyframeId}`,
      { method: "DELETE" },
    ),
  addDepthOfFieldKeyframe: (
    projectId: string,
    keyframe: DepthOfFieldKeyframeCreate,
  ) =>
    apiRequest<Project>(
      `/projects/${projectId}/camera/depth-of-field/keyframes`,
      { method: "POST", body: JSON.stringify(keyframe) },
    ),
  updateDepthOfFieldKeyframe: (
    projectId: string,
    keyframeId: string,
    keyframe: DepthOfFieldKeyframeUpdate,
  ) =>
    apiRequest<Project>(
      `/projects/${projectId}/camera/depth-of-field/keyframes/${keyframeId}`,
      { method: "PATCH", body: JSON.stringify(keyframe) },
    ),
  deleteDepthOfFieldKeyframe: (projectId: string, keyframeId: string) =>
    apiRequest<Project>(
      `/projects/${projectId}/camera/depth-of-field/keyframes/${keyframeId}`,
      { method: "DELETE" },
    ),
  clearTrajectory: (projectId: string) =>
    apiRequest<Project>(`/projects/${projectId}/trajectory`, {
      method: "DELETE",
    }),
  compile: (projectId: string) =>
    apiRequest<CompiledTrajectory>(
      `/projects/${projectId}/trajectory/compiled`,
    ),
  saveUserMessage: (projectId: string, id: string, message: string) =>
    apiRequest<Project>(`/projects/${projectId}/chat/user-messages`, {
      method: "POST",
      body: JSON.stringify({ id, message }),
    }),
  chat: (projectId: string, id: string, message: string) =>
    apiRequest<ChatResult>(`/projects/${projectId}/chat/messages`, {
      method: "POST",
      body: JSON.stringify({ id, message }),
    }),
};
