"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, projectKeys } from "@/entities/project";
import { invalidateProjectResource } from "@/entities/project/api/invalidate-project-resource";
import { forgetProjectRevision } from "@/shared/api/orval-fetch";

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectApi.delete,
    onSuccess: async (_, projectId) => {
      forgetProjectRevision(projectId);
      await queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useDeleteAnchor(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectApi.deleteAnchor(projectId, id),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "anchors"),
    onError: () => invalidateProjectResource(queryClient, projectId, "anchors"),
  });
}

export function useDeleteSpeedKeyframe(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectApi.deleteSpeedKeyframe(projectId, id),
    onSuccess: () => invalidateProjectResource(queryClient, projectId, "speed"),
    onError: () => invalidateProjectResource(queryClient, projectId, "speed"),
  });
}

export function useDeleteCameraKeyframe(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectApi.deleteCameraKeyframe(projectId, id),
    onSuccess: () => invalidateProjectResource(queryClient, projectId, "aim"),
    onError: () => invalidateProjectResource(queryClient, projectId, "aim"),
  });
}

export function useDeleteCameraOrientationKeyframe(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      projectApi.deleteCameraOrientationKeyframe(projectId, id),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
  });
}

export function useDeleteDepthOfFieldKeyframe(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      projectApi.deleteDepthOfFieldKeyframe(projectId, id),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "depthOfField"),
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "depthOfField"),
  });
}
