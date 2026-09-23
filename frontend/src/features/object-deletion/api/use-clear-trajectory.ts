"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi } from "@/entities/project";

import { invalidateProjectResource } from "@/entities/project/api/invalidate-project-resource";

export function useClearTrajectory(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => projectApi.clearTrajectory(projectId),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "segments"),
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "segments"),
  });
}
