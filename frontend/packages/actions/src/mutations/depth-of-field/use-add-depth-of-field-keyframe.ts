"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  type DepthOfFieldKeyframeCreate,
} from "@camera-path/api/project";

import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useAddDepthOfFieldKeyframe(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
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
