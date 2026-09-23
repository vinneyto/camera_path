"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi } from "@/entities/project";

interface UpdateAnchorLiftVariables {
  anchorId: string;
  lift: number;
}

import { invalidateProjectResource } from "@/entities/project/api/invalidate-project-resource";

export function useUpdateAnchor(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ anchorId, lift }: UpdateAnchorLiftVariables) =>
      projectApi.updateAnchor(projectId, anchorId, { lift }),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "anchors"),
    onError: () => invalidateProjectResource(queryClient, projectId, "anchors"),
  });
}
