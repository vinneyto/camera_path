import type { AnchorCreate, Project } from "@/entities/project/model/types";
import type { ChatResult, CompiledTrajectory } from "@/entities/trajectory/model/types";
import { apiRequest } from "@/shared/api/http";

export const projectApi = {
  list: () => apiRequest<Project[]>("/projects"),
  get: (projectId: string) => apiRequest<Project>(`/projects/${projectId}`),
  create: (name: string) =>
    apiRequest<Project>("/projects", { method: "POST", body: JSON.stringify({ name }) }),
  addAnchor: (projectId: string, anchor: AnchorCreate) =>
    apiRequest<Project>(`/projects/${projectId}/anchors`, {
      method: "POST",
      body: JSON.stringify(anchor),
    }),
  compile: (projectId: string) =>
    apiRequest<CompiledTrajectory>(`/projects/${projectId}/trajectory/compiled`),
  chat: (projectId: string, message: string) =>
    apiRequest<ChatResult>(`/projects/${projectId}/chat/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
