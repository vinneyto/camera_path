"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  type CameraOrientationKeyframeCreate,
} from "@/entities/project";

import { invalidateProjectResource } from "@/entities/project/api/invalidate-project-resource";

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
