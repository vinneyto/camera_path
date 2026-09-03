"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, projectKeys, type Project } from "@/entities/project";

function useProjectObjectDeletion(
  projectId: string,
  deleteObject: (projectId: string, objectId: string) => Promise<Project>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (objectId: string) => deleteObject(projectId, objectId),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.trajectory(projectId) });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectApi.delete,
    onSuccess: (_, projectId) => {
      queryClient.setQueryData<Project[]>(projectKeys.list(), (projects) =>
        projects?.filter((project) => project.id !== projectId),
      );
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.removeQueries({ queryKey: projectKeys.trajectory(projectId) });
    },
  });
}

export function useDeleteAnchor(projectId: string) {
  return useProjectObjectDeletion(projectId, projectApi.deleteAnchor);
}

export function useDeleteSpeedKeyframe(projectId: string) {
  return useProjectObjectDeletion(projectId, projectApi.deleteSpeedKeyframe);
}

export function useDeleteCameraKeyframe(projectId: string) {
  return useProjectObjectDeletion(projectId, projectApi.deleteCameraKeyframe);
}
