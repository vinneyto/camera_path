"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi } from "@camera-path/api/project";

interface UpdateAnchorLiftVariables {
  anchorId: string;
  lift: number;
}

import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useUpdateAnchor(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ anchorId, lift }: UpdateAnchorLiftVariables) =>
      projectApi.updateAnchor(projectId, anchorId, { lift }),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "anchors"),
    onError: () => invalidateProjectResource(queryClient, projectId, "anchors"),
  });
}
