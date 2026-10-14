"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  type DepthOfFieldKeyframeCreate,
} from "@host/adapters/project";

import { invalidateProjectResource } from "@host/adapters/project/invalidate-project-resource";

export function useAddDepthOfFieldKeyframe(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyframe: DepthOfFieldKeyframeCreate) =>
      projectApi.addDepthOfFieldKeyframe(projectId, keyframe),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "depthOfField"),
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "depthOfField"),
  });
}
