"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, type AnchorCreate } from "@/entities/project";

import { invalidateProjectResource } from "@/entities/project/api/invalidate-project-resource";

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
