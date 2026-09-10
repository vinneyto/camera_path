"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, projectKeys } from "@/entities/project";

interface UpdateAnchorLiftVariables {
  anchorId: string;
  lift: number;
}

export function useUpdateAnchor(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ anchorId, lift }: UpdateAnchorLiftVariables) =>
      projectApi.updateAnchor(projectId, anchorId, { lift }),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: projectKeys.trajectory(projectId),
      });
    },
  });
}
