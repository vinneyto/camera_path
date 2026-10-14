"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, type AnchorCreate } from "@host/adapters/project";

import { invalidateProjectResource } from "@host/adapters/project/invalidate-project-resource";

export function useAddAnchor(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (anchor: AnchorCreate) =>
      projectApi.addAnchor(projectId, anchor),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "anchors"),
    onError: () => invalidateProjectResource(queryClient, projectId, "anchors"),
  });
}
