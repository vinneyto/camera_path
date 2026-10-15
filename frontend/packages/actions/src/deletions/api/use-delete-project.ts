"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { forgetProjectRevision } from "@camera-path/api/client/orval-fetch";
import { projectApi, projectKeys } from "@camera-path/api/project";

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
