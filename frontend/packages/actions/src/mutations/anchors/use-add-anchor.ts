"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, type AnchorCreate } from "@camera-path/api/project";

import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useAddAnchor(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (anchor: AnchorCreate) =>
      projectApi.addAnchor(projectId, anchor),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "anchors"),
    onError: () => invalidateProjectResource(queryClient, projectId, "anchors"),
  });
}
