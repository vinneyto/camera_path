"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  projectKeys,
  type ProjectSettings,
} from "@/entities/project";

export function useUpdateProjectSettings(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: ProjectSettings) =>
      projectApi.updateSettings(projectId, settings),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}
