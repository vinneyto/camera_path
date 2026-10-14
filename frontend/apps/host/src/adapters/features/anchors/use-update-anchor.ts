"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi } from "@host/adapters/project";

interface UpdateAnchorLiftVariables {
  anchorId: string;
  lift: number;
}

import { invalidateProjectResource } from "@host/adapters/project/invalidate-project-resource";

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
