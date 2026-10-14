"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  type CameraOrientationKeyframeCreate,
} from "@host/adapters/project";

import { invalidateProjectResource } from "@host/adapters/project/invalidate-project-resource";

export function useAddCameraOrientationKeyframe(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyframe: CameraOrientationKeyframeCreate) =>
      projectApi.addCameraOrientationKeyframe(projectId, keyframe),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
  });
}
