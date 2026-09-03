import type { AnchorCreate, Project } from "@/entities/project/model/types";
import type { ChatResult, CompiledTrajectory } from "@/entities/trajectory/model/types";
import { apiRequest } from "@/shared/api/http";

export const projectApi = {
  list: () => apiRequest<Project[]>("/projects"),
  get: (projectId: string) => apiRequest<Project>(`/projects/${projectId}`),
  create: (name: string) =>
    apiRequest<Project>("/projects", { method: "POST", body: JSON.stringify({ name }) }),
  delete: (projectId: string) =>
    apiRequest<void>(`/projects/${projectId}`, { method: "DELETE" }),
  addAnchor: (projectId: string, anchor: AnchorCreate) =>
    apiRequest<Project>(`/projects/${projectId}/anchors`, {
      method: "POST",
      body: JSON.stringify(anchor),
    }),
  deleteAnchor: (projectId: string, anchorId: string) =>
    apiRequest<Project>(`/projects/${projectId}/anchors/${anchorId}`, { method: "DELETE" }),
  deleteSpeedKeyframe: (projectId: string, keyframeId: string) =>
    apiRequest<Project>(`/projects/${projectId}/motion/keyframes/${keyframeId}`, { method: "DELETE" }),
  deleteCameraKeyframe: (projectId: string, keyframeId: string) =>
    apiRequest<Project>(`/projects/${projectId}/camera/keyframes/${keyframeId}`, { method: "DELETE" }),
  compile: (projectId: string) =>
    apiRequest<CompiledTrajectory>(`/projects/${projectId}/trajectory/compiled`),
  chat: (projectId: string, message: string) =>
    apiRequest<ChatResult>(`/projects/${projectId}/chat/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
