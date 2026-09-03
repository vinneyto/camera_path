"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, projectKeys, type AnchorCreate } from "@/entities/project";

export function useAddAnchor(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (anchor: AnchorCreate) => projectApi.addAnchor(projectId, anchor),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      void queryClient.invalidateQueries({ queryKey: projectKeys.trajectory(projectId) });
    },
  });
}
