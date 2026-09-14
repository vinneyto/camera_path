"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, projectKeys } from "@/entities/project";

export function useClearTrajectory(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => projectApi.clearTrajectory(projectId),
    onSuccess: async (project) => {
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.trajectory(projectId),
        }),
      ]);
    },
  });
}
