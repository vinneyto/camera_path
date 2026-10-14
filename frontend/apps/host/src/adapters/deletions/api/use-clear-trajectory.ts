"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi } from "@host/adapters/project";

import { invalidateProjectResource } from "@host/adapters/project/invalidate-project-resource";

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
